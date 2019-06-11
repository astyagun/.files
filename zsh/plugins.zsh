function zplg_prezto_module() {
  zplg ice wait'0' svn lucid
  zplg snippet PZT::modules/$1
}

# Zsh setup

zplg ice svn lucid
zplg snippet PZT::modules/history

HISTORY_KEYS='bindkey -M emacs "^P" history-substring-search-up; bindkey -M emacs "^N" history-substring-search-down'
zplg ice wait'0' atload"$HISTORY_KEYS" lucid
zplg load zsh-users/zsh-history-substring-search

zplg ice wait'0' lucid
zplg load zsh-users/zsh-autosuggestions

zplg_prezto_module completion


# Functions, aliases and completions

zstyle ':prezto:module:utility:ls' color 'yes'
zstyle ':prezto:module:utility:diff' color 'yes'
zstyle ':prezto:module:utility:wdiff' color 'yes'
zstyle ':prezto:module:utility:make' color 'yes'
zstyle ':prezto:module:utility' correct 'yes'
zstyle ':prezto:module:utility' safe-ops 'yes'
zplg_prezto_module utility
zplg_prezto_module git
zplg_prezto_module homebrew

zplg ice wait'0' lucid
zplg load akarzim/zsh-docker-aliases

zplg ice wait'0' lucid
zplg load djui/alias-tips


# Navigation

alias cdc='code cd'
alias mydiraction_dispatch=_diraction-dispatch
zplg ice wait'0' cp'__diraction-dispatch -> _mydiraction-dispatch' atload'diraction create code ~/Code' lucid
zplg load AdrieanKhisbe/diractions


# Visual

zplg ice pick'async.zsh' src'pure.zsh'
zplg light sindresorhus/pure
PROMPT=$(echo "$PROMPT" | sed 's/magenta/green/')

zplg ice wait'0' atclone'gdircolors -b LS_COLORS > clrs.zsh' atpull'%atclone' pick'clrs.zsh' lucid
zplg load trapd00r/LS_COLORS

zplg ice wait'0' lucid
zplg load ael-code/zsh-colored-man-pages

# Syntax highlighting, to be loaded last, also atinit'' executes callbacks for completions
zplg ice wait'0c' atinit'zpcompinit; zpcdreplay' lucid
export ZSH_HIGHLIGHT_HIGHLIGHTERS=(main brackets cursor line pattern root)
zplg load zsh-users/zsh-syntax-highlighting
