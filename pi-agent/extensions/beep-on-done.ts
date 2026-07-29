import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Beep on done – plays a terminal bell (ASCII 0x07) when the agent
 * finishes generating after a long response, so you hear it even
 * when you're not looking at the Terminal.
 *
 * Only beeps if the agent run took longer than MIN_SECONDS.
 */

const MIN_SECONDS = 30;

export default function (pi: ExtensionAPI) {
  let startTime = 0;

  pi.on("agent_start", async (_event, _ctx) => {
    startTime = Date.now();
  });

  pi.on("agent_settled", async (_event, ctx) => {
    // Only beep in TUI mode (interactive) so non-interactive modes stay silent.
    if (ctx.mode !== "tui") return;

    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed >= MIN_SECONDS) {
      process.stdout.write("\x07");
    }
  });
}
