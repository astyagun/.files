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

- Explicit user permission or request is required to start making changes to the workspace
- If making a plan is justified, get plan template from <https://raw.githubusercontent.com/astyagun/.vim/refs/heads/master/UltiSnips/markdown.snippets>, lines between `snippet plan` and `endsnippet`. If asking user questions to fill it in, ask them one at time.
- User probably knows more, than they've written in their initial prompt. Asking them will often yield faster result, than investigating. So first try asking.
- When in doubt, ask user
- If you ask user a question, give them options or ask them to run some code, don't make a tool call. Wait them to respond instead.
- Follow KISS and YAGNI principles. Pursue maximum simplicity, complicate things only gradually, one level at a time and only after user request or permission.
- Personal use scripts require much lower defensiveness and documentation verbosity
- Default for scripts is Bash. But once things get complicated, like requiring arrays and associative arrays, consider and suggest converting the script to Ruby.
