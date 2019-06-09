function zplg_prezto_module() {
  zplg ice wait'0' svn silent
  zplg snippet PZT::modules/$1
}

# Zsh setup

zplg ice svn silent
zplg snippet PZT::modules/history

HISTORY_KEYS='bindkey -M emacs "^P" history-substring-search-up; bindkey -M emacs "^N" history-substring-search-down'
zplg ice wait'0' atload"$HISTORY_KEYS" silent
zplg load zsh-users/zsh-history-substring-search

zplg ice wait'0' silent
zplg load zsh-users/zsh-autosuggestions

zplg_prezto_module completion


# Functions, aliases and completions

zplg_prezto_module utility
zplg_prezto_module git
zplg_prezto_module homebrew

zplg ice wait'0' silent
zplg load akarzim/zsh-docker-aliases


# Navigation

alias cdc='code cd'
alias mydiraction_dispatch=_diraction-dispatch
zplg ice wait'0' cp'__diraction-dispatch -> _mydiraction-dispatch' atload'diraction create code ~/Code' silent
zplg load AdrieanKhisbe/diractions


# Syntax highlighting, to be loaded last, also atinit'' executes callbacks for completions
zplg ice wait'0c' atinit'zpcompinit; zpcdreplay' silent
export ZSH_HIGHLIGHT_HIGHLIGHTERS=(main brackets cursor line pattern root)
zplg load zsh-users/zsh-syntax-highlighting
