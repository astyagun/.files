function zinit_prezto_module() {
  zinit ice wait'0' svn lucid
  zinit snippet PZT::modules/$1
}

function zinit_omz_completion_plugin() {
  zinit ice wait'0' svn pick'' lucid
  zinit snippet OMZ::plugins/$1
}

# Zsh setup

zinit ice svn lucid
zinit snippet PZT::modules/history

HISTORY_KEYS='bindkey -M emacs "^P" history-substring-search-up; bindkey -M emacs "^N" history-substring-search-down'
zinit ice wait'0' atload"$HISTORY_KEYS" lucid
zinit load zsh-users/zsh-history-substring-search

zinit_prezto_module completion
zinit_prezto_module directory


# Functions, aliases and completions

zstyle ':prezto:module:utility:ls' color 'yes'
zstyle ':prezto:module:utility:diff' color 'yes'
zstyle ':prezto:module:utility:wdiff' color 'yes'
zstyle ':prezto:module:utility:make' color 'yes'
zstyle ':prezto:module:utility' correct 'yes'
zstyle ':prezto:module:utility' safe-ops 'yes'
zinit_prezto_module utility

zinit_prezto_module git
zinit_prezto_module homebrew

zinit ice wait'0' lucid
zinit load akarzim/zsh-docker-aliases

zinit ice wait'0' lucid
zinit load djui/alias-tips

zinit_omz_completion_plugin httpie


# Navigation

alias cdc='code cd'
alias mydiraction_dispatch=_diraction-dispatch
zinit ice wait'0' cp'__diraction-dispatch -> _mydiraction-dispatch' atload'diraction create code ~/Code' lucid
zinit load AdrieanKhisbe/diractions


# Visual

zstyle :prompt:pure:prompt:success color green
zinit ice pick'async.zsh' src'pure.zsh'
zinit light sindresorhus/pure

zinit ice wait'0' lucid
zinit load ael-code/zsh-colored-man-pages

# Syntax highlighting, to be loaded last, also atinit'' executes callbacks for completions
zinit ice wait'0' atinit'zpcompinit; zpcdreplay' lucid
export ZSH_HIGHLIGHT_HIGHLIGHTERS=(main brackets cursor line pattern root)
zinit load zsh-users/zsh-syntax-highlighting

# Needs to be loaded after zsh-syntax-highlighting
zinit ice wait'0' atload'_zsh_autosuggest_start' lucid
zinit load zsh-users/zsh-autosuggestions
