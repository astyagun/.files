/**
 * Doom loop guard.
 *
 * Mitigates two doom loop failure modes:
 *
 * 1. Loop inside one thinking block. While thinking streams, watch for the
 *    tail of the block being one text unit repeated back-to-back with no
 *    variation (…UUU). On detection: abort the
 *    stream (a looping model does not stop by itself; steering cannot reach
 *    hidden thinking mid-stream), then send a steer user message for the
 *    next attempt. Up to STEER_RETRIES per repetition incident (resets on a
 *    clean thinking block), then give up with plain abort + warning.
 *
 * 2. Loop across LLM messages. A message is a repeat only if the whole
 *    message (thinking + text + tool calls) is identical to a previous one,
 *    or an identical group of messages repeats. Match is exact (after
 *    whitespace/case normalization), no fuzzy similarity. Escalation mirrors
 *    the thinking loop: first nudge after the 3rd repeat, nudge again at the
 *    6th, abort at the 9th.
 *
 * /doomguard - toggle guard, show counters.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// --- tuning ---------------------------------------------------------------

// Thinking-block loop detection.
const THINK_GRAM = 48; // normalized chars of tail used to find the period
const THINK_MIN_REPS = 3; // consecutive repetitions of one unit that mark a loop
const THINK_MIN_TOTAL = 144; // min thinking length before checking
const THINK_CHECK_EVERY = 256; // chars of new thinking between checks
const STEER_RETRIES = 3; // abort+steer attempts per repetition incident

// Repeated message detection (whole message: thinking + text + tool calls).
const MSG_MIN_CHARS = 40; // skip trivial messages
const MSG_WINDOW = 8; // compare against last N message signatures
const REPEAT_NUDGE_1 = 3; // first nudge after this many repeats
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
 * True when the last K messages (K=2..4) equal the K before them — an
 * identical group/cycle of messages repeating (e.g. A B A B).
 */
function isGroupRepeat(sigs: string[]): boolean {
	for (let k = 2; k <= 4; k++) {
		if (sigs.length < 2 * k) continue;
		let match = true;
		for (let i = 0; i < k; i++) {
			if (sigs[sigs.length - k + i] !== sigs[sigs.length - 2 * k + i]) {
				match = false;
				break;
			}
		}
		if (match) return true;
	}
	return false;
}

/**
 * Loop = text ends with one unit repeated back-to-back, no variation
 * between repetitions (…UUU). Finds the candidate period from the previous
 * occurrence of the tail gram, then verifies consecutive repetition
 * backwards from the end. Returns the repeated unit.
 */
function detectLoop(raw: string): string | undefined {
	const norm = normalize(raw);
	const n = norm.length;
	if (n < THINK_MIN_TOTAL) return undefined;
	const gram = norm.slice(n - THINK_GRAM);
	// Closest previous occurrence of the tail gram => candidate period.
	// In periodic text the closest occurrence is exactly one period back;
	// a long gram also catches short-period loops (it spans whole periods).
	const prev = norm.lastIndexOf(gram, n - THINK_GRAM - 1);
	if (prev === -1) return undefined;
	const period = n - THINK_GRAM - prev;
	if (period <= 0) return undefined;
	// Verify: unit repeats consecutively back from the end.
	const unit = norm.slice(n - period);
	let reps = 1;
	let pos = n - period;
	while (pos >= period && norm.startsWith(unit, pos - period)) {
		reps++;
		pos -= period;
	}
	return reps >= THINK_MIN_REPS ? unit : undefined;
}

// --- extension ------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	let enabled = true;
	const stats = { thinkingAborts: 0, thinkingSteers: 0, nudges: 0, msgAborts: 0 };

	// Thinking stream state: contentIndex -> buffer.
	let thinkBufs = new Map<number, { text: string; checked: number; fired: boolean }>();
	// Consecutive thinking-loop incidents without a clean thinking block in between.
	let steerRetries = 0;
	// Whether a loop fired in the current assistant message; guards the thinking_end reset.
	let loopFiredInMessage = false;

	// Cross-message state: recent whole-message signatures + repeat streak.
	let recentSigs: string[] = [];
	let repeatStreak = 0;

	function resetCrossMessage() {
		recentSigs = [];
		repeatStreak = 0;
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
			resetCrossMessage();
		}
	});

	// 1. Loop inside a single thinking block.
	pi.on("message_update", async (event, ctx) => {
		const ev = event.assistantMessageEvent;
		if (!enabled) return;
		if (ev.type === "thinking_start") {
			thinkBufs.set(ev.contentIndex, { text: "", checked: 0, fired: false });
			return;
		}
		if (ev.type === "thinking_end") {
			// A thinking block completed without a loop: incident over. Only reset when
			// no loop fired anywhere in this message (a clean block right after an
			// aborted loop in the same message must not clear the incident).
			if (steerRetries > 0 && !loopFiredInMessage && !thinkBufs.get(ev.contentIndex)?.fired) steerRetries = 0;
			return;
		}
		if (ev.type !== "thinking_delta") return;
		let buf = thinkBufs.get(ev.contentIndex);
		if (!buf) {
			buf = { text: "", checked: 0, fired: false };
			thinkBufs.set(ev.contentIndex, buf);
		}
		buf.text += ev.delta;
		if (buf.fired || buf.text.length - buf.checked < THINK_CHECK_EVERY) return;
		buf.checked = buf.text.length;
		const unit = detectLoop(buf.text);
		if (!unit) return;
		buf.fired = true;
		loopFiredInMessage = true;
		stats.thinkingAborts++;
		const snippet = unit.slice(0, 60);
		if (!ctx.isIdle()) ctx.abort();
		if (steerRetries < STEER_RETRIES) {
			steerRetries++;
			stats.thinkingSteers++;
			pi.sendUserMessage(
				[
					"doom-loop-guard: thinking looped, repeating this verbatim:",
					`"${snippet}"`,
					"Stop. Change approach: re-read the file/output, try a different tool, or state the blocker. Do not restate.",
					makeSteerMarker(),
				].join(" "),
				{ deliverAs: "steer" },
			);
		}
	});

	// 2. Identical whole messages across messages: nudge, then abort.
	pi.on("message_end", async (event, ctx) => {
		const m = event.message;
		if (!enabled || m.role !== "assistant") return;
		const sig = messageSignature(m);
		if (sig.length < MSG_MIN_CHARS) {
			repeatStreak = 0;
			return;
		}
		// A repeat is a consecutive identical message (A A A) or an identical
		// group/cycle (A B A B). A message matching an earlier one with variation
		// in between (A B A C A D) is NOT a repeat.
		const repeated =
			(recentSigs.length > 0 && recentSigs[recentSigs.length - 1] === sig) ||
			isGroupRepeat(recentSigs);
		recentSigs.push(sig);
		while (recentSigs.length > MSG_WINDOW) recentSigs.shift();

		if (!repeated) {
			repeatStreak = 0;
			return;
		}
		repeatStreak++;
		if (repeatStreak === REPEAT_NUDGE_1) {
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
		} else if (repeatStreak === REPEAT_NUDGE_2) {
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
		} else if (repeatStreak === REPEAT_ABORT) {
			stats.msgAborts++;
			if (!ctx.isIdle()) ctx.abort();
			pi.sendMessage(
				{
					customType: NUDGE_TYPE,
					content: "doom-loop-guard: model keeps repeating the same message. Aborted. Rephrase the task or intervene manually.",
					display: true,
				},
				{ triggerTurn: false },
			);
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
