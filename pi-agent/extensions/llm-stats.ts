/**
 * LLM stats extension.
 *
 * Footer: time, PP (prefill) TPS and TG (decode) TPS for the last LLM message.
 * On wide terminals the stats are centered on the default stats line; on narrow
 * terminals they fall back to their own line.
 *
 * /stats: session aggregates - total LLM answer time, PP/TG TPS bucketed by
 * context size (powers of two, starting at 4096 or lower for small sessions),
 * rendered in chat in native /session style (bold headers, dim labels, table).
 *
 * Per-message stats are persisted as custom session entries so aggregates
 * survive session resume.
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

interface MsgStats {
	/** Prompt tokens (input + cacheRead + cacheWrite). */
	ctx: number;
	/** Output tokens. */
	out: number;
	/** Total response time in ms. */
	totalMs: number;
	/** Prefill (time to first token) in ms; 0 when unknown. */
	ppMs: number;
	/** Wall-clock tool time after this message, ms (parallel calls merged). */
	toolMs?: number;
}

interface ToolTimeData {
	ms: number;
}

interface ReportData {
	totalMs: number;
	totalToolMs: number;
	avgTtftMs: number;
	count: number;
	buckets: Array<{ size: number; count: number; ppTokens: number; ppMs: number; tgTokens: number; tgMs: number; toolMs: number }>;
}

const ENTRY_TYPE = "llm-stats";
const TOOL_ENTRY_TYPE = "llm-tool-time";
const REPORT_TYPE = "llm-stats-report";

function fmtTps(tokens: number, ms: number): string {
	if (ms <= 0 || tokens <= 0) return "-";
	const tps = tokens / (ms / 1000);
	return tps >= 100 ? tps.toFixed(0) : tps.toFixed(1);
}

function fmtMs(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	const m = Math.floor(ms / 60000);
	return `${m}m${Math.round((ms % 60000) / 1000)}s`;
}

function bucketOf(ctxTokens: number): number {
	let b = 512;
	while (b < ctxTokens) b *= 2;
	return b;
}

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

function computeBuckets(messages: MsgStats[]): Array<{ size: number } & ReportData["buckets"][number]> {
	const map = new Map<number, ReportData["buckets"][number]>();
	for (const m of messages) {
		const size = bucketOf(m.ctx);
		let b = map.get(size);
		if (!b) {
			b = { size, count: 0, ppTokens: 0, ppMs: 0, tgTokens: 0, tgMs: 0, toolMs: 0 };
			map.set(size, b);
		}
		b.count++;
		b.ppTokens += m.ctx;
		b.ppMs += m.ppMs;
		b.tgTokens += m.out;
		b.tgMs += m.totalMs - m.ppMs;
		b.toolMs += m.toolMs ?? 0;
	}
	const sizes = [...map.keys()].sort((a, b) => a - b);
	const start = sizes.length > 0 ? Math.min(4096, sizes[0]) : 4096;
	return [...map.values()].filter((b) => b.size >= start);
}

function avgTtft(messages: MsgStats[]): number {
	const known = messages.filter((m) => m.ppMs > 0);
	return known.length === 0 ? 0 : known.reduce((s, m) => s + m.ppMs, 0) / known.length;
}

/** Sum of wall-clock time of overlapping intervals (parallel tool calls counted once). */
function mergeSum(intervals: Array<[number, number]>): number {
	if (intervals.length === 0) return 0;
	intervals.sort((a, b) => a[0] - b[0]);
	let total = 0;
	let [cs, ce] = intervals[0];
	for (const [s, e] of intervals.slice(1)) {
		if (s > ce) {
			total += ce - cs;
			cs = s;
			ce = e;
		} else if (e > ce) ce = e;
	}
	return total + (ce - cs);
}

export default function (pi: ExtensionAPI) {
	let messages: MsgStats[] = [];
	let startMs = 0;
	let firstDeltaMs = 0;
	let requestRender: (() => void) | undefined;
	const toolStarts = new Map<string, number>();
	let toolIntervals: Array<[number, number]> = [];

	// Attribute merged tool time of the finished segment to the last LLM message.
	const flushToolTime = () => {
		if (toolIntervals.length === 0) return undefined;
		const ms = mergeSum(toolIntervals);
		toolIntervals = [];
		const last = messages[messages.length - 1];
		if (!last || ms <= 0) return undefined;
		last.toolMs = (last.toolMs ?? 0) + ms;
		pi.appendEntry(TOOL_ENTRY_TYPE, { ms } satisfies ToolTimeData);
		return ms;
	};

	const lastStatsText = (): string | undefined => {
		const last = messages[messages.length - 1];
		if (!last) return undefined;
		const tool = last.toolMs ? `  \u{1f527} ${fmtMs(last.toolMs)}` : "";
		return `\u23f1 ${fmtMs(last.totalMs)}  TTFT ${fmtMs(last.ppMs)}  PP ${fmtTps(last.ctx, last.ppMs)} t/s  TG ${fmtTps(last.out, last.totalMs - last.ppMs)} t/s${tool}`;
	};

	const rebuild = (sessionManager: { getBranch(fromId?: string): any[] }) => {
		messages = [];
		toolStarts.clear();
		toolIntervals = [];
		for (const entry of sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === ENTRY_TYPE && entry.data) {
				messages.push(entry.data as MsgStats);
			} else if (entry.type === "custom" && entry.customType === TOOL_ENTRY_TYPE && entry.data) {
				const last = messages[messages.length - 1];
				if (last) last.toolMs = (last.toolMs ?? 0) + ((entry.data as ToolTimeData).ms ?? 0);
			}
		}
	};

	// ---- Custom footer: replicate built-in layout, add centered LLM stats ----

	const installFooter = (ctx: ExtensionContext) => {
		ctx.ui.setFooter((tui, theme, footerData) => {
			requestRender = () => tui.requestRender();
			const unsub = footerData.onBranchChange(() => tui.requestRender());

			// Cache token totals; entries are append-only, recompute on change.
			let statsCache:
				| { key: string; input: number; output: number; cacheRead: number; cacheWrite: number; cost: number; hitRate?: number }
				| undefined;

			const getTokenStats = () => {
				const sm = ctx.sessionManager;
				// Every append moves the leaf, so leafId identifies the entry state.
				const key = `${sm.getSessionId()}:${sm.getLeafId()}`;
				if (statsCache && statsCache.key === key) return statsCache;
				const s = { key, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, hitRate: undefined as number | undefined };
				for (const e of sm.getEntries() as any[]) {
					let u: any;
					if (e.type === "usage") u = e.usage;
					else if (e.type === "message" && (e.message.role === "assistant" || e.message.role === "toolResult")) u = e.message.usage;
					else if ((e.type === "branch_summary" || e.type === "compaction") && e.usage) u = e.usage;
					if (!u) continue;
					s.input += u.input ?? 0;
					s.output += u.output ?? 0;
					s.cacheRead += u.cacheRead ?? 0;
					s.cacheWrite += u.cacheWrite ?? 0;
					s.cost += u.cost?.total ?? 0;
					if (e.type === "message" && e.message.role === "assistant") {
						const prompt = (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
						s.hitRate = prompt > 0 ? ((u.cacheRead ?? 0) / prompt) * 100 : undefined;
					}
				}
				statsCache = s;
				return s;
			};

			return {
				dispose: () => {
					unsub();
					requestRender = undefined;
				},
				invalidate() {},
				render(width: number): string[] {
					// Line 1: pwd (branch) - session name
					const home = process.env.HOME || process.env.USERPROFILE;
					let pwd = home && ctx.cwd.startsWith(home) ? `~${ctx.cwd.slice(home.length)}` : ctx.cwd;
					const branch = footerData.getGitBranch();
					if (branch) pwd = `${pwd} (${branch})`;
					const sessionName = ctx.sessionManager.getSessionName();
					if (sessionName) pwd = `${pwd} • ${sessionName}`;

					// Line 2: token stats left, model right, LLM stats centered
					const ts = getTokenStats();
					const parts: string[] = [];
					if (ts.input) parts.push(`↑${formatTokens(ts.input)}`);
					if (ts.output) parts.push(`↓${formatTokens(ts.output)}`);
					if (ts.cacheRead) parts.push(`R${formatTokens(ts.cacheRead)}`);
					if (ts.cacheWrite) parts.push(`W${formatTokens(ts.cacheWrite)}`);
					if ((ts.cacheRead > 0 || ts.cacheWrite > 0) && ts.hitRate !== undefined) parts.push(`CH${ts.hitRate.toFixed(1)}%`);
					if (ts.cost) parts.push(`$${ts.cost.toFixed(3)}`);
					const usage = ctx.getContextUsage();
					if (usage) {
						const pct = usage.percent ?? null;
						const disp = pct === null ? `?/${formatTokens(usage.contextWindow)}` : `${pct.toFixed(1)}%/${formatTokens(usage.contextWindow)}`;
						parts.push(pct !== null && pct > 90 ? theme.fg("error", disp) : pct !== null && pct > 70 ? theme.fg("warning", disp) : disp);
					}
					const left = theme.fg("dim", parts.join(" "));
					let right = ctx.model?.id || "no-model";
					if (ctx.model?.reasoning) {
						const level = ctx.thinkingLevel || "off";
						right = level === "off" ? `${right} • thinking off` : `${right} • ${level}`;
					}
					right = theme.fg("dim", right);

					const center = lastStatsText();
					const lines: string[] = [truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "..."))];

					const leftW = visibleWidth(left);
					const rightW = visibleWidth(right);
					const centerW = center ? visibleWidth(center) : 0;
					const centerCol = center ? Math.floor((width - centerW) / 2) : 0;

					if (center && leftW + 2 + centerW + 2 + rightW <= width && centerCol >= leftW + 1 && centerCol + centerW + 1 <= width - rightW) {
						// Wide: left ... centered stats ... right
						const l = `${left}${" ".repeat(centerCol - leftW)}`;
						const remainder = `${theme.fg("dim", center)}${" ".repeat(width - centerCol - centerW - rightW)}${right}`;
						lines.push(truncateToWidth(l + remainder, width));
					} else if (leftW + 2 + rightW <= width) {
						// Narrow: left ... right, stats on their own line
						lines.push(truncateToWidth(left + " ".repeat(Math.max(2, width - leftW - rightW)) + right, width));
						if (center) lines.push(truncateToWidth(theme.fg("dim", center), width, theme.fg("dim", "...")));
					} else {
						lines.push(truncateToWidth(left, width, theme.fg("dim", "...")));
						if (center) lines.push(truncateToWidth(theme.fg("dim", center), width, theme.fg("dim", "...")));
					}

					// Other extension statuses (our stats are not set via setStatus)
					const others = Array.from(footerData.getExtensionStatuses().entries())
						.filter(([k]) => k !== "llm-stats")
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([, t]) => t.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim());
					if (others.length > 0) lines.push(truncateToWidth(others.join(" "), width, theme.fg("dim", "...")));

					return lines;
				},
			};
		});
	};

	// ---- Entry renderer for /stats report, native /session style ----

	pi.registerEntryRenderer<ReportData>(REPORT_TYPE, (entry, _opts, theme) => {
		const d = entry.data;
		const text = new Text("", 1, 0);
		const render = (t: Theme) => {
			if (!d) return t.bold("LLM Stats") + "\n" + t.fg("dim", "No data");
			let info = `${t.bold("LLM Stats")}\n\n`;
			info += `${t.fg("dim", "Messages:")} ${d.count}\n`;
			info += `${t.fg("dim", "Total answer time:")} ${fmtMs(d.totalMs)}\n`;
			if (d.totalToolMs > 0) info += `${t.fg("dim", "Total tool time:")} ${fmtMs(d.totalToolMs)}\n`;
			if (d.avgTtftMs > 0) info += `${t.fg("dim", "Avg TTFT:")} ${fmtMs(d.avgTtftMs)}\n`;
			info += `\n${t.bold("By Context Size")}\n\n`;
			const header = "Context".padEnd(12) + "Msgs".padStart(6) + "PP t/s".padStart(10) + "TG t/s".padStart(10) + "Tool".padStart(9);
			info += t.fg("dim", header) + "\n";
			for (const b of d.buckets) {
				info +=
					`<=${b.size.toLocaleString()}`.padEnd(12) +
					`${b.count}`.padStart(6) +
					`${fmtTps(b.ppTokens, b.ppMs)}`.padStart(10) +
					`${fmtTps(b.tgTokens, b.tgMs)}`.padStart(10) +
					`${b.toolMs > 0 ? fmtMs(b.toolMs) : "-"}`.padStart(9) +
					"\n";
			}
			return info.trimEnd();
		};
		text.setText(render(theme));
		// Re-render on theme change is not tracked here; acceptable for personal use.
		return text;
	});

	// ---- Events ----

	pi.on("session_start", async (_event, ctx) => {
		rebuild(ctx.sessionManager);
		startMs = 0;
		firstDeltaMs = 0;
		if (ctx.mode === "tui") installFooter(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		rebuild(ctx.sessionManager);
		requestRender?.();
	});

	pi.on("message_start", async (event) => {
		if (event.message.role === "assistant") {
			// Tools that ran before this message belong to the previous one.
			flushToolTime();
			startMs = Date.now();
			firstDeltaMs = 0;
		}
	});

	pi.on("tool_execution_start", async (event) => {
		toolStarts.set(event.toolCallId, Date.now());
	});

	pi.on("tool_execution_end", async (event) => {
		const start = toolStarts.get(event.toolCallId);
		if (start !== undefined) {
			toolIntervals.push([start, Date.now()]);
			toolStarts.delete(event.toolCallId);
		}
	});

	pi.on("agent_end", async () => {
		flushToolTime();
		requestRender?.();
	});

	pi.on("message_update", async (event) => {
		if (firstDeltaMs === 0 && event.assistantMessageEvent.type.endsWith("_delta")) {
			firstDeltaMs = Date.now();
		}
	});

	pi.on("message_end", async (event, ctx) => {
		const msg = event.message as AssistantMessage;
		if (msg.role !== "assistant" || !msg.usage) return;
		const totalMs = typeof msg.durationMs === "number" ? msg.durationMs : Date.now() - startMs;
		const ppMs = firstDeltaMs > 0 && startMs > 0 ? firstDeltaMs - startMs : 0;
		const usage = msg.usage;
		const stats: MsgStats = {
			ctx: (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0),
			out: usage.output ?? 0,
			totalMs,
			ppMs,
		};
		messages.push(stats);
		pi.appendEntry(ENTRY_TYPE, stats);
		requestRender?.();
	});

	pi.registerCommand("stats", {
		description: "LLM timing stats: total answer time, PP/TG TPS by context size",
		handler: async (_args, ctx) => {
			flushToolTime();
			if (messages.length === 0) {
				ctx.ui.notify("No LLM stats yet", "info");
				return;
			}
			const data: ReportData = {
				totalMs: messages.reduce((s, m) => s + m.totalMs, 0),
				totalToolMs: messages.reduce((s, m) => s + (m.toolMs ?? 0), 0),
				avgTtftMs: avgTtft(messages),
				count: messages.length,
				buckets: computeBuckets(messages),
			};
			if (ctx.mode === "tui") {
				pi.appendEntry(REPORT_TYPE, data);
			} else {
				const lines = [`LLM Stats - ${data.count} messages, total ${fmtMs(data.totalMs)}, tool ${fmtMs(data.totalToolMs)}, avg TTFT ${fmtMs(data.avgTtftMs)}`];
				for (const b of data.buckets) {
					lines.push(`ctx <=${b.size.toLocaleString()}: ${b.count} msgs  PP ${fmtTps(b.ppTokens, b.ppMs)} t/s  TG ${fmtTps(b.tgTokens, b.tgMs)} t/s  Tool ${b.toolMs > 0 ? fmtMs(b.toolMs) : "-"}`);
				}
				ctx.ui.notify(lines.join("\n"), "info");
			}
		},
	});
}
