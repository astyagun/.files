/**
 * Doom loop guard.
 *
 * Mitigates two doom loop failure modes:
 *
 * 1. Loop inside one thinking block. While thinking streams, split the block
 *    into paragraphs (text between blank lines). Every completed paragraph is
 *    stored and takes part in verification — everything between repetitions
 *    must repeat too, short paragraphs included. A paragraph with at least
 *    PARAGRAPH_MIN_WORDS words (and a letter or number) that exactly equals
 *    an earlier paragraph anchors repetition candidates, one per distinct
 *    distance to such an occurrence. Each candidate must keep matching: every
 *    following paragraph has to equal its period-step-back predecessor,
 *    otherwise the candidate is dropped. Fire when a candidate has matched
 *    (FIRE_AFTER_CYCLES - 1) * period paragraphs in a row — the cycle has
 *    then been seen FIRE_AFTER_CYCLES times in full (a 5-paragraph cycle
 *    fires at 15 paragraphs). On fire: abort the stream (a looping model
 *    does not stop by itself; steering cannot reach hidden thinking
 *    mid-stream) and queue the retry message; it is delivered automatically
 *    once the aborted run settles (a steer queued behind an abort is never
 *    drained in that run), starting a fresh run. Up to STEER_RETRIES per
 *    repetition incident (resets on a clean thinking block), then give up
 *    with plain abort + warning.
 *
 * 2. Loop across LLM messages. A message is a repeat only if the whole
 *    message (thinking + text + tool calls) is identical to a previous one.
 *    Match is exact (after whitespace/case normalization), no fuzzy
 *    similarity. Repetition tracking mirrors the thinking guard: a message
 *    identical to an earlier one anchors repetition candidates (one per
 *    distinct distance, any period); every following message must keep
 *    matching its period-step-back predecessor or the candidate is dropped.
 *    Escalation counts full repetitions of the repeated cycle: first nudge
 *    when the cycle has appeared 3 times, second at 6, abort at 9 (abort +
 *    warning entry, delivered once the run settles; a final abort suppresses
 *    any pending retry — nothing may follow it).
 *
 * /doomguard - toggle guard, show counters.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// --- tuning ---------------------------------------------------------------

// Thinking-block loop detection (paragraph repetition).
const PARAGRAPH_MIN_WORDS = 3; // paragraphs with fewer words never anchor a candidate
const FIRE_AFTER_CYCLES = 3; // fire when the repeated cycle has repeated this many times in full
const STEER_RETRIES = 3; // abort+steer attempts per repetition incident

// Repeated message detection (whole message: thinking + text + tool calls).
const MSG_MIN_CHARS = 40; // skip trivial messages
const REPEAT_NUDGE_1 = 3; // first nudge when the repeated cycle has appeared this many times
const REPEAT_NUDGE_2 = 6; // second nudge
const REPEAT_ABORT = 9; // final abort

const NUDGE_TYPE = "doom-loop-guard";

// --- helpers --------------------------------------------------------------

function normalize(s: string): string {
	return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function stableStringify(v: unknown): string {
	if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
	if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
	const o = v as Record<string, unknown>;
	return `{${Object.keys(o)
		.sort()
		.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
		.join(",")}}`;
}

/**
 * Canonical signature of an assistant message: normalized thinking + text +
 * tool calls (name + stable args), joined. Two messages are repeats only if
 * their signatures are identical.
 */
function messageSignature(m: { content: Array<{ type: string; thinking?: string; text?: string; name?: string; arguments?: unknown }> }): string {
	const parts: string[] = [];
	for (const c of m.content) {
		if (c.type === "thinking") parts.push("T:" + normalize(c.thinking ?? ""));
		else if (c.type === "text") parts.push("X:" + normalize(c.text ?? ""));
		else if (c.type === "toolCall") parts.push("C:" + c.name + "|" + stableStringify(c.arguments));
	}
	return parts.join(";");
}

/**
 * Streaming state for one thinking block: raw text so far, the offset of the
 * paragraph currently being streamed, completed paragraphs, and the active
 * repetition candidates.
 */
type ThinkBuf = {
	text: string;
	/** Offset of the start of the paragraph currently being streamed. */
	consumed: number;
	/** Completed paragraphs in order, short and empty ones included. */
	paras: string[];
	/** Active repetition candidates: verified period + matched paragraph count. */
	candidates: { period: number; matched: number }[];
	fired: boolean;
};

/**
 * Feed one completed thinking paragraph into the repetition tracker.
 *
 * - Every completed paragraph is stored; all of them take part in candidate
 *   verification (everything between repetitions must repeat too).
 * - Active candidates verify: the paragraph must equal its period-step-back
 *   predecessor; a mismatch drops the candidate.
 * - A paragraph with >= PARAGRAPH_MIN_WORDS words and at least one
 *   letter/number anchors a new candidate for every distinct distance to an
 *   earlier identical paragraph (empty lines, brackets, dividers never
 *   anchor). Periods already tracked are not duplicated.
 * - Fire when a candidate has matched (FIRE_AFTER_CYCLES - 1) * period
 *   paragraphs in a row: the cycle has been seen FIRE_AFTER_CYCLES times in
 *   full (a 5-paragraph cycle fires at 15 paragraphs). Returns the smallest
 *   firing period, else undefined.
 */
function trackParagraph(buf: ThinkBuf, para: string): { period: number } | undefined {
	buf.paras.push(para);
	const m = buf.paras.length - 1;
	let firePeriod: number | undefined;
	for (let c = buf.candidates.length - 1; c >= 0; c--) {
		const cand = buf.candidates[c];
		if (para === buf.paras[m - cand.period]) {
			cand.matched++;
			if (cand.matched >= (FIRE_AFTER_CYCLES - 1) * cand.period) {
				firePeriod = firePeriod === undefined ? cand.period : Math.min(firePeriod, cand.period);
			}
		} else {
			buf.candidates.splice(c, 1);
		}
	}
	if (firePeriod !== undefined) return { period: firePeriod };
	const words = para.split(/\s+/).filter(Boolean);
	if (words.length < PARAGRAPH_MIN_WORDS || !/\p{L}|\p{N}/u.test(para)) return undefined;
	// Anchor: one candidate per distinct distance to an earlier identical paragraph.
	for (let i = 0; i < m; i++) {
		if (buf.paras[i] !== para) continue;
		const period = m - i;
		if (!buf.candidates.some((c) => c.period === period)) buf.candidates.push({ period, matched: 1 });
	}
	return undefined;
}

// --- extension ------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	let enabled = true;
	const stats = { thinkingAborts: 0, thinkingSteers: 0, nudges: 0, msgAborts: 0 };

	// Thinking stream state: contentIndex -> paragraph repetition tracker.
	let thinkBufs = new Map<number, ThinkBuf>();
	// Consecutive thinking-loop incidents without a clean thinking block in between.
	let steerRetries = 0;
	// Whether a loop fired in the current assistant message; guards the thinking_end reset.
	let loopFiredInMessage = false;
	// Retry message queued at fire time, delivered once the aborted run settles
	// (a steer queued behind an abort is never drained in the aborted run).
	let pendingSteer: string | undefined;
	// Final-abort warning queued at level 9, delivered the same way; suppresses
	// any pending retry — nothing may follow a final abort.
	let pendingWarning: string | undefined;

	// Cross-message state: history of non-trivial message signatures + repetition
	// candidates (same tracker shape as the thinking guard, any period).
	let msgSigs: string[] = [];
	let msgCandidates: { period: number; matched: number }[] = [];
	// Nudge flags: one nudge per level per repetition incident; reset when the
	// candidate list empties (a non-repeated message ended the incident).
	let nudge1Done = false;
	let nudge2Done = false;

	function resetCrossMessage() {
		msgSigs = [];
		msgCandidates = [];
		nudge1Done = false;
		nudge2Done = false;
	}

	// Nonces embedded in our own steer messages, so we can recognize them when
	// they come back as user messages and not treat them as new user intent.
	// Random per steer: a user typing "doom-loop-guard:" cannot reproduce a nonce.
	const issuedSteerNonces = new Set<string>();

	function makeSteerMarker(): string {
		const nonce = Math.random().toString(36).slice(2, 10);
		issuedSteerNonces.add(nonce);
		return `[dlg:${nonce}]`;
	}

	function isOwnSteerMessage(text: string): boolean {
		const m = /\[dlg:([0-9a-z]+)\]/.exec(text);
		if (!m) return false;
		return issuedSteerNonces.delete(m[1]);
	}

	function userMessageText(message: { content: string | Array<{ type: string; text?: string }> }): string {
		if (typeof message.content === "string") return message.content;
		return message.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join(" ");
	}

	pi.on("session_start", async () => {
		thinkBufs = new Map();
		steerRetries = 0;
		loopFiredInMessage = false;
		pendingSteer = undefined;
		pendingWarning = undefined;
		issuedSteerNonces.clear();
		resetCrossMessage();
	});

	pi.on("message_start", async (event) => {
		const role = event.message.role;
		if (role === "assistant") {
			thinkBufs = new Map();
			loopFiredInMessage = false;
		}
		// New user intent: previous repetition no longer counts. Our own steer
		// messages arrive as user messages too: they must NOT reset the counters.
		if (role === "user" && !isOwnSteerMessage(userMessageText(event.message))) {
			steerRetries = 0;
			pendingSteer = undefined; // real user intent supersedes a queued retry
			pendingWarning = undefined;
			resetCrossMessage();
		}
	});

	// 1. Loop inside a single thinking block.
	pi.on("message_update", async (event, ctx) => {
		const ev = event.assistantMessageEvent;
		if (!enabled) return;
		if (ev.type === "thinking_start") {
			thinkBufs.set(ev.contentIndex, { text: "", consumed: 0, paras: [], candidates: [], fired: false });
			return;
		}
		if (ev.type === "thinking_end") {
			// A thinking block completed without a loop: incident over. Only reset when
			// no loop fired anywhere in this message (a clean block right after an
			// aborted loop in the same message must not clear the incident).
			// The trailing paragraph (no blank line after it) never participates:
			// if thinking ended, the loop cannot continue.
			if (steerRetries > 0 && !loopFiredInMessage && !thinkBufs.get(ev.contentIndex)?.fired) steerRetries = 0;
			return;
		}
		if (ev.type !== "thinking_delta") return;
		let buf = thinkBufs.get(ev.contentIndex);
		if (!buf) {
			buf = { text: "", consumed: 0, paras: [], candidates: [], fired: false };
			thinkBufs.set(ev.contentIndex, buf);
		}
		if (buf.fired) return;
		buf.text += ev.delta;
		// Completed paragraphs = text between blank lines; feed each to the tracker.
		for (;;) {
			const end = buf.text.indexOf("\n\n", buf.consumed);
			if (end === -1) break;
			const para = buf.text.slice(buf.consumed, end);
			buf.consumed = end + 2;
			const firedAt = trackParagraph(buf, para);
			if (!firedAt) continue;
			buf.fired = true;
			loopFiredInMessage = true;
			stats.thinkingAborts++;
			const m = buf.paras.length - 1;
			const cycle = buf.paras.slice(m - firedAt.period + 1, m + 1).join("\n\n");
			const snippet = cycle.length > 200 ? cycle.slice(0, 200) + "…" : cycle;
			if (!ctx.isIdle()) ctx.abort();
			if (steerRetries < STEER_RETRIES) {
				steerRetries++;
				stats.thinkingSteers++;
				// Queue the retry; deliver it once the aborted run settles (a steer
				// queued behind an abort is never drained in that run).
				pendingSteer = [
					`doom-loop-guard: thinking looped, repeating this ${firedAt.period}-paragraph cycle verbatim:`,
					`"${snippet}"`,
					"Stop. Change approach: re-read the file/output, try a different tool, or state the blocker. Do not restate.",
					makeSteerMarker(),
				].join(" ");
			}
			break;
		}
	});

	// Deliver queued messages once the aborted run settles: the session is idle
	// at that point. A pending retry (user message) starts the fresh run; a
	// pending warning (display entry) is appended without starting a run. A
	// final abort suppresses any retry: nothing may follow it.
	pi.on("agent_settled", async (event, ctx) => {
		if (pendingSteer === undefined && pendingWarning === undefined) return;
		if (!enabled || !event.aborted) {
			// Guard disabled since the fire, or the run ended without an abort
			// (the loop stopped by itself): the queued messages are stale, drop them.
			pendingSteer = undefined;
			pendingWarning = undefined;
			return;
		}
		const steer = pendingSteer;
		const warning = pendingWarning;
		pendingSteer = undefined;
		pendingWarning = undefined;
		if (!ctx.isIdle()) return; // user already started something: stale, drop
		if (warning !== undefined) {
			pi.sendMessage({ customType: NUDGE_TYPE, content: warning, display: true }, { triggerTurn: false });
			return;
		}
		if (steer !== undefined) pi.sendUserMessage(steer);
	});

	// 2. Identical whole messages across messages: nudge, then abort.
	pi.on("message_end", async (event, ctx) => {
		const m = event.message;
		if (!enabled || m.role !== "assistant") return;
		const sig = messageSignature(m);
		if (sig.length < MSG_MIN_CHARS) {
			// Trivial messages neither count as progress nor as repeats; resetting
			// the streak here would let alternating loops evade escalation.
			return;
		}
		// Repetition tracking mirrors the thinking guard: every following message
		// must equal its period-step-back predecessor, otherwise the candidate is
		// dropped — a message that finally escapes the cycle cannot be counted as
		// a repeat. Escalation counts full repetitions of the repeated cycle:
		// matched == (N - 1) * period means the cycle has appeared N times.
		msgSigs.push(sig);
		const mi = msgSigs.length - 1;
		let fire: { period: number; level: 1 | 2 | 9 } | undefined;
		for (let c = msgCandidates.length - 1; c >= 0; c--) {
			const cand = msgCandidates[c];
			if (sig === msgSigs[mi - cand.period]) {
				cand.matched++;
				const level =
					cand.matched === (REPEAT_NUDGE_1 - 1) * cand.period ? 1 :
					cand.matched === (REPEAT_NUDGE_2 - 1) * cand.period ? 2 :
					cand.matched === (REPEAT_ABORT - 1) * cand.period ? 9 : 0;
				if (level !== 0 && (!fire || cand.period < fire.period)) fire = { period: cand.period, level };
			} else {
				msgCandidates.splice(c, 1);
			}
		}
		if (!fire) {
			// Anchor: one candidate per distinct distance to an earlier identical
			// signature (any period; no window limit).
			for (let i = 0; i < mi; i++) {
				if (msgSigs[i] !== sig) continue;
				const period = mi - i;
				if (!msgCandidates.some((c) => c.period === period)) msgCandidates.push({ period, matched: 1 });
			}
			if (msgCandidates.length === 0) {
				nudge1Done = false;
				nudge2Done = false;
			}
			return;
		}
		if (fire.level === 1 && !nudge1Done) {
			nudge1Done = true;
			stats.nudges++;
			pi.sendMessage(
				{
					customType: NUDGE_TYPE,
					content:
						"doom-loop-guard: this assistant message repeats a previous message verbatim (thinking, text, and tool calls). " +
						"You appear to be looping. Change approach or report the blocker to the user.",
					display: true,
				},
				{ triggerTurn: true },
			);
		} else if (fire.level === 2 && !nudge2Done) {
			nudge2Done = true;
			stats.nudges++;
			pi.sendMessage(
				{
					customType: NUDGE_TYPE,
					content:
						"doom-loop-guard: the same message keeps repeating. Stop looping: change approach or report the blocker to the user.",
					display: true,
				},
				{ triggerTurn: true },
			);
		} else if (fire.level === 9) {
			stats.msgAborts++;
			if (!ctx.isIdle()) ctx.abort();
			// Final abort: no retry. Queue the warning; deliver it once the run
			// settles (a message queued behind an abort is never drained in that
			// run). Any pending retry is dropped — nothing may follow a final abort.
			pendingSteer = undefined;
			pendingWarning =
				"doom-loop-guard: model keeps repeating the same message. Aborted. Rephrase the task or intervene manually.";
		}
	});

	pi.registerCommand("doomguard", {
		description: "Doom-loop guard status. Subcommands: on, off, reset",
		handler: async (args, ctx) => {
			const sub = args.trim().toLowerCase();
			switch (sub) {
				case "":
					ctx.ui.notify(
						`doom-loop-guard ${enabled ? "ON" : "OFF"} | thinking aborts: ${stats.thinkingAborts} (steers: ${stats.thinkingSteers}) | msg nudges: ${stats.nudges} | msg aborts: ${stats.msgAborts} | subcommands: on, off, reset`,
						"info",
					);
					return;
				case "on":
					enabled = true;
					ctx.ui.notify("doom-loop-guard ON", "info");
					return;
				case "off":
					enabled = false;
					ctx.ui.notify("doom-loop-guard OFF", "info");
					return;
				case "reset":
					stats.thinkingAborts = 0;
					stats.thinkingSteers = 0;
					stats.nudges = 0;
					stats.msgAborts = 0;
					steerRetries = 0;
					pendingSteer = undefined;
					pendingWarning = undefined;
					thinkBufs = new Map();
					issuedSteerNonces.clear();
					resetCrossMessage();
					ctx.ui.notify("doom-loop-guard: counters and loop history reset", "info");
					return;
				default:
					ctx.ui.notify(`doom-loop-guard: unknown subcommand "${sub}". Subcommands: on, off, reset`, "error");
			}
		},
	});
}
