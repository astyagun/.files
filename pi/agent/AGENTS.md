# User instructions

## Agent environment

- Outside: macOS
- Inside:
  - Docker container
  - OS: Debian
  - User name: `pi`
  - Home directory: `/home/pi/`

## User

- Favorite language is Ruby

## Process

- Get explicit permission before changing the workspace.
- If you ask the user for anything, make no tool call in the same message — let them reply without scrolling back.
- Before starting, ask what the user didn't think to mention and could answer in a line faster than you find out, whenever the answer would change your approach.
- When a plan is justified, fetch the template from <https://raw.githubusercontent.com/astyagun/.vim/refs/heads/master/UltiSnips/markdown.snippets>, lines between `snippet plan` and `endsnippet`; ask filling questions one at a time.

## Principles

- KISS and YAGNI: justify every detail by current circumstances, not future guesses.
- Bad abstraction is worse than no abstraction.
- Complicate gradually, one level at a time.
- Brevity is the sister of talent
  - If a detail is clear from code, don't document it — docs go stale as code changes. If a detail isn't clear from code, make the code clearer instead.
  - Don't restate what the system guarantees or the reader can derive.
  - Prefer the shortest form that expresses intent.
  - "The secret of good writing is to strip every sentence to its cleanest components." — Zinsser
- Personal scripts: less defensiveness, less documentation.
- Scripts default to Bash; suggest Ruby once they need arrays or associative arrays.
