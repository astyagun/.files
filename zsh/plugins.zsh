function zpl_prezto_module() {
  zpl ice wait'0' svn lucid
  zpl snippet PZT::modules/$1
}

# Zsh setup

zpl ice svn lucid
zpl snippet PZT::modules/history

HISTORY_KEYS='bindkey -M emacs "^P" history-substring-search-up; bindkey -M emacs "^N" history-substring-search-down'
zpl ice wait'0' atload"$HISTORY_KEYS" lucid
zpl load zsh-users/zsh-history-substring-search

zpl_prezto_module completion
zpl_prezto_module directory


# Functions, aliases and completions

zstyle ':prezto:module:utility:ls' color 'yes'
zstyle ':prezto:module:utility:diff' color 'yes'
zstyle ':prezto:module:utility:wdiff' color 'yes'
zstyle ':prezto:module:utility:make' color 'yes'
zstyle ':prezto:module:utility' correct 'yes'
zstyle ':prezto:module:utility' safe-ops 'yes'
zpl_prezto_module utility
zpl_prezto_module git
zpl_prezto_module homebrew

zpl ice wait'0' lucid
zpl load akarzim/zsh-docker-aliases

zpl ice wait'0' lucid
zpl load djui/alias-tips


# Navigation

alias cdc='code cd'
alias mydiraction_dispatch=_diraction-dispatch
zpl ice wait'0' cp'__diraction-dispatch -> _mydiraction-dispatch' atload'diraction create code ~/Code' lucid
zpl load AdrieanKhisbe/diractions


# Visual

zpl ice pick'async.zsh' src'pure.zsh'
zpl light sindresorhus/pure
PROMPT=$(echo "$PROMPT" | sed 's/magenta/green/')

zpl ice wait'0' lucid
zpl load ael-code/zsh-colored-man-pages

# Syntax highlighting, to be loaded last, also atinit'' executes callbacks for completions
zpl ice wait'0' atinit'zpcompinit; zpcdreplay' lucid
export ZSH_HIGHLIGHT_HIGHLIGHTERS=(main brackets cursor line pattern root)
zpl load zsh-users/zsh-syntax-highlighting

# Needs to be loaded after zsh-syntax-highlighting
zpl ice wait'0' atload'_zsh_autosuggest_start' lucid
zpl load zsh-users/zsh-autosuggestions
