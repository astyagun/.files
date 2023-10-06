function zinit_prezto_module() {
  zinit ice wait svn lucid
  zinit snippet "PZT::modules/$1"
}

function zinit_omz_completion_plugin() {
  zinit ice wait as'completion' svn lucid
  zinit snippet "OMZ::plugins/$1"
}

# Zsh setup {{{

zstyle ':prezto:module:history' histsize 10000 # Fixes unavailability of history from previsou sessions for some reason
zinit ice wait svn lucid
zinit snippet PZT::modules/history

HISTORY_KEYS='bindkey -M emacs "^P" history-substring-search-up; bindkey -M emacs "^N" history-substring-search-down'
zinit ice wait atload"$HISTORY_KEYS" lucid
zinit light zsh-users/zsh-history-substring-search

zinit_prezto_module directory

# }}} Zsh setup

# Functions, aliases and completions {{{

zstyle ':prezto:module:utility:ls' color 'yes'
zstyle ':prezto:module:utility:diff' color 'yes'
zstyle ':prezto:module:utility:wdiff' color 'yes'
zstyle ':prezto:module:utility:make' color 'yes'
zstyle ':prezto:module:utility' correct 'yes'
zstyle ':prezto:module:utility' safe-ops 'yes'
zinit ice wait svn lucid atload'alias _ >/dev/null && unalias _'
zinit snippet PZT::modules/utility

zinit_prezto_module git
zinit_prezto_module homebrew

# Original aliaes use `mutagen compose`, which is not available for me, I have `mutagen-compose` only. Use manually
# updated aliases instead.
# zinit ice wait atload"$MUTAGEN_ALIASES" lucid
# zinit light akarzim/zsh-docker-aliases
source ~/.files/zsh/docker-aliases.zsh

zinit ice wait lucid
zinit light djui/alias-tips

zinit_omz_completion_plugin httpie

zinit ice wait as'completion' svn lucid
zinit light zsh-users/zsh-completions

# }}} Functions, aliases and completions

# Navigation {{{

alias cdc='code cd'
alias mydiraction_dispatch=_diraction-dispatch
zinit ice wait \
  cp'__diraction-dispatch -> _mydiraction-dispatch' \
  atload'diraction create code ~/Code' \
  lucid
zinit light AdrieanKhisbe/diractions

# }}} Navigation

# Visual {{{

SPACESHIP_PROMPT_ORDER=(
  dir           # Current directory section
  git           # Git section (git_branch + git_status)
  exec_time     # Execution time
  line_sep      # Line break
  battery       # Battery level and status
  jobs          # Background jobs indicator
  exit_code     # Exit code section
  sudo          # Indicator when user has cached passwordless permissions
  char          # Prompt character
)

SPACESHIP_CHAR_COLOR_FAILURE=088
SPACESHIP_CHAR_COLOR_SECONDARY=094
SPACESHIP_CHAR_COLOR_SUCCESS=022
SPACESHIP_DIR_COLOR=022
SPACESHIP_EXEC_TIME_COLOR=094
SPACESHIP_EXEC_TIME_ELAPSED=5
SPACESHIP_EXIT_CODE_SHOW=true
SPACESHIP_GIT_BRANCH_COLOR=238
SPACESHIP_GIT_STATUS_COLOR=088
SPACESHIP_PROMPT_PREFIXES_SHOW=false
SPACESHIP_SUDO_SHOW=true

zinit light spaceship-prompt/spaceship-prompt

zinit ice wait lucid
zinit light ael-code/zsh-colored-man-pages

# }}} Visual

# chruby {{{

if [ -f $(brew --prefix)/opt/chruby/share/chruby/chruby.sh ]; then
  # Make `chruby` available when Zsh is run from MacVim
  CHRUBY_WAIT=$([[ -z "$VIM" ]] && echo wait)

  zinit ice ${CHRUBY_WAIT} atload'chruby ruby-2.7' lucid
  zinit snippet $(brew --prefix)/opt/chruby/share/chruby/chruby.sh
fi

# }}} chruby

# Must be loaded after PZT utility and other completions
zinit_prezto_module completion

# Syntax highlighting, to be loaded last, also atinit'' executes callbacks for completions {{{
export ZSH_HIGHLIGHT_HIGHLIGHTERS=(main brackets cursor line pattern root)
zinit ice wait atinit'zicompinit; zicdreplay' lucid
zinit light zsh-users/zsh-syntax-highlighting
# }}} Syntax highlighting, to be loaded last, also atinit'' executes callbacks for completions

# Needs to be loaded after zsh-syntax-highlighting {{{
zinit ice wait atload'_zsh_autosuggest_start' lucid
zinit light zsh-users/zsh-autosuggestions
# }}} Needs to be loaded after zsh-syntax-highlighting
