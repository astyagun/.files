/**
 * Doom loop guard.
 *
 * Mitigates two doom loop failure modes:
 *
 * 1. Loop inside one thinking block. While thinking streams, watch for the
 *    tail n-gram recurring verbatim several times. On detection: abort the
 *    stream (a looping model does not stop by itself; steering cannot reach
 *    hidden thinking mid-stream), then send a steer user message for the
 *    next attempt. Up to STEER_RETRIES per repetition incident (resets on a
 *    clean thinking block), then give up with plain abort + warning.
 *
 * 2. Loop across LLM messages.
 *    - Identical tool calls (same name + same arguments) repeated in a row:
 *      warn at 2x, block at 3x with an instructive reason the model sees.
 *    - Identical assistant text or thinking across messages: inject a
 *      hidden nudge message telling the model to change strategy, warn the
 *      user if repetition continues. Match is exact (after whitespace/case
 *      normalization), no fuzzy similarity.
 *
 * /doomguard - toggle guard, show counters.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// --- tuning ---------------------------------------------------------------

// Thinking-block loop detection.
const THINK_GRAM = 48; // normalized chars in the tail gram to track
const THINK_MIN_REPS = 3; // occurrences of the tail gram that mark a loop
const THINK_CHECK_EVERY = 256; // chars of new thinking between checks
const STEER_RETRIES = 3; // abort+steer attempts per repetition incident

// Repeated tool call detection.
const TOOL_WARN_AFTER = 2; // identical calls before warning
const TOOL_BLOCK_AFTER = 3; // identical calls before blocking
const TOOL_WINDOW = 12; // look at last N tool calls

// Repeated assistant content detection.
const TEXT_MIN_CHARS = 80; // skip short messages
const TEXT_WINDOW = 6; // compare against last N exact texts

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

/** Tail gram repeated THINK_MIN_REPS times => loop. Returns the gram. */
function detectLoop(raw: string): string | undefined {
	const norm = normalize(raw);
	if (norm.length < THINK_GRAM * THINK_MIN_REPS * 2) return undefined;
	const gram = norm.slice(norm.length - THINK_GRAM);
	let reps = 0;
	for (let i = norm.indexOf(gram); i !== -1; i = norm.indexOf(gram, i + 1)) reps++;
	return reps >= THINK_MIN_REPS ? gram : undefined;
}

// --- extension ------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	let enabled = true;
	const stats = { thinkingAborts: 0, thinkingSteers: 0, toolWarns: 0, toolBlocks: 0, nudges: 0 };

	// Thinking stream state: contentIndex -> buffer.
	let thinkBufs = new Map<number, { text: string; checked: number; fired: boolean }>();
	// Consecutive thinking-loop incidents without a clean thinking block in between.
	let steerRetries = 0;

	// Cross-message state.
	let toolSigs: string[] = [];
	let recentTexts: string[] = [];
	let repeatStreak = 0;

	function resetCrossMessage() {
		toolSigs = [];
		recentTexts = [];
		repeatStreak = 0;
	}

	pi.on("session_start", async () => {
		thinkBufs = new Map();
		steerRetries = 0;
		resetCrossMessage();
	});

	pi.on("message_start", async (event) => {
		const role = event.message.role;
		if (role === "assistant") thinkBufs = new Map();
		// New user intent: previous repetition no longer counts.
		if (role === "user") {
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
			// A thinking block completed without a loop: incident over.
			if (steerRetries > 0 && !thinkBufs.get(ev.contentIndex)?.fired) steerRetries = 0;
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
		const gram = detectLoop(buf.text);
		if (!gram) return;
		buf.fired = true;
		stats.thinkingAborts++;
		const snippet = gram.slice(0, 60);
		try {
			ctx.abort();
		} catch {
			// already idle
		}
		if (steerRetries < STEER_RETRIES) {
			steerRetries++;
			stats.thinkingSteers++;
			ctx.ui.notify(
				`doom-loop-guard: thinking loop ("${snippet}" x${THINK_MIN_REPS}). Abort ${steerRetries}/${STEER_RETRIES}, steering.`,
				"warning",
			);
			pi.sendUserMessage(
				[
					"doom-loop-guard: your previous thinking looped, repeating this verbatim several times:",
					`"${snippet}"`,
					"Stop that line of reasoning. In short thinking, list what you have established so far,",
					"then take a clearly different approach: re-read the actual file or command output,",
					"try a different tool, or state the concrete blocker. Do not restate the same reasoning.",
				].join(" "),
				{ deliverAs: "steer" },
			);
		} else {
			ctx.ui.notify(
				`doom-loop-guard: thinking loop persists after ${STEER_RETRIES} steer attempts. Aborted. Rephrase the task or intervene manually.`,
				"error",
			);
		}
	});

	// 2a. Identical tool calls: warn, then block.
	pi.on("tool_call", async (event, ctx) => {
		if (!enabled || event.parentToolCallId) return;
		const sig = `${event.toolName}|${stableStringify(event.input)}`;
		const reps = toolSigs.slice(-TOOL_WINDOW).filter((s) => s === sig).length + 1;
		toolSigs.push(sig);
		if (toolSigs.length > 64) toolSigs.shift();
		if (reps >= TOOL_BLOCK_AFTER) {
			stats.toolBlocks++;
			ctx.ui.notify(`doom-loop-guard: blocked repeated ${event.toolName} call (${reps}x identical)`, "warning");
			return {
				block: true,
				reason:
					`doom-loop-guard: identical ${event.toolName} call already made ${reps - 1}x with identical arguments. Blocked. ` +
					"Do not repeat it. Change the arguments, use a different tool, or explain the blocker to the user.",
			};
		}
		if (reps === TOOL_WARN_AFTER) {
			stats.toolWarns++;
			ctx.ui.notify(`doom-loop-guard: identical ${event.toolName} call repeated ${reps}x`, "warning");
		}
	});

	// 2b. Identical assistant content across messages: nudge.
	pi.on("message_end", async (event, ctx) => {
		const m = event.message;
		if (!enabled || m.role !== "assistant") return;
		const parts: string[] = [];
		for (const c of m.content) {
			if (c.type === "text") parts.push(c.text);
			else if (c.type === "thinking") parts.push(c.thinking);
		}
		const texts = parts.map(normalize).filter((t) => t.length >= TEXT_MIN_CHARS);
		if (texts.length === 0) {
			repeatStreak = 0;
			return;
		}
		const repeated = texts.some((t) => recentTexts.includes(t));
		recentTexts.push(...texts);
		while (recentTexts.length > TEXT_WINDOW) recentTexts.shift();

		if (!repeated) {
			repeatStreak = 0;
			return;
		}
		repeatStreak++;
		if (repeatStreak === 1) {
			stats.nudges++;
			pi.sendMessage({
				customType: NUDGE_TYPE,
				content:
					"doom-loop-guard: this assistant message repeats content already produced earlier in this run, verbatim. " +
					"You appear to be looping. Do not repeat the same content or tool calls. " +
					"Change approach (different tool, different arguments, re-read the failing output) or report the blocker to the user.",
				display: false,
			});
			ctx.ui.notify("doom-loop-guard: assistant message repeated verbatim, nudged model", "warning");
		} else if (repeatStreak === 3) {
			ctx.ui.notify("doom-loop-guard: model keeps repeating itself. Consider aborting (Esc) and rephrasing the task.", "error");
		}
	});

	pi.registerCommand("doomguard", {
		description: "Doom-loop guard status. Subcommands: on, off, reset",
		handler: async (args, ctx) => {
			const sub = args.trim().toLowerCase();
			switch (sub) {
				case "":
					ctx.ui.notify(
						`doom-loop-guard ${enabled ? "ON" : "OFF"} | thinking aborts: ${stats.thinkingAborts} (steers: ${stats.thinkingSteers}) | tool warns: ${stats.toolWarns} | tool blocks: ${stats.toolBlocks} | nudges: ${stats.nudges} | subcommands: on, off, reset`,
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
					stats.toolWarns = 0;
					stats.toolBlocks = 0;
					stats.nudges = 0;
					steerRetries = 0;
					resetCrossMessage();
					ctx.ui.notify("doom-loop-guard: counters and loop history reset", "info");
					return;
				default:
					ctx.ui.notify(`doom-loop-guard: unknown subcommand "${sub}". Subcommands: on, off, reset`, "error");
			}
		},
	});
}
