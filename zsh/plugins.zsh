source ~/.files/zsh/fix_snippets.zsh

function zinit_prezto_module() {
  zinit wait lucid atpull"%atclone" atclone"_fix-pzt-module" for "PZT::modules/$1"
}

# Required for PZT:: prefix fix above
zinit_prezto_module helper
zinit_prezto_module spectrum

# Zsh setup {{{

zstyle ':prezto:module:history' histsize 10000 # Fixes unavailability of history from previsou sessions for some reason
zinit_prezto_module history

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
zinit wait lucid atload'alias _ >/dev/null && unalias _' atpull"%atclone" atclone"_fix-pzt-module" for PZT::modules/utility

zinit_prezto_module git
zinit_prezto_module homebrew

# Original aliaes use `mutagen compose`, which is not available for me, I have `mutagen-compose` only. Use manually
# updated aliases instead.
# zinit ice wait atload"$MUTAGEN_ALIASES" lucid
# zinit light akarzim/zsh-docker-aliases
source ~/.files/zsh/docker-aliases.zsh

zinit ice wait as'completion' lucid
zinit light ocodo/ollama_zsh_completion

zinit ice wait lucid
zinit light djui/alias-tips

zinit ice wait as'completion' lucid
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

eval "$(starship init zsh)"

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
