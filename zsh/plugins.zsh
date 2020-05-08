function zinit_prezto_module() {
  zinit ice wait svn lucid
  zinit snippet "PZT::modules/$1"
}

function zinit_omz_completion_plugin() {
  zinit ice wait as'completion' svn lucid
  zinit snippet "OMZ::plugins/$1"
}

# Zsh setup {{{

zinit ice wait svn lucid
zinit snippet PZT::modules/history

HISTORY_KEYS='bindkey -M emacs "^P" history-substring-search-up; bindkey -M emacs "^N" history-substring-search-down'
zinit ice wait atload"$HISTORY_KEYS" lucid
zinit light zsh-users/zsh-history-substring-search

zinit_prezto_module completion
zinit_prezto_module directory

# }}} Zsh setup

# Functions, aliases and completions {{{

zstyle ':prezto:module:utility:ls' color 'yes'
zstyle ':prezto:module:utility:diff' color 'yes'
zstyle ':prezto:module:utility:wdiff' color 'yes'
zstyle ':prezto:module:utility:make' color 'yes'
zstyle ':prezto:module:utility' correct 'yes'
zstyle ':prezto:module:utility' safe-ops 'yes'
zinit_prezto_module utility

zinit_prezto_module git
zinit_prezto_module homebrew

zinit ice wait lucid
zinit light akarzim/zsh-docker-aliases

zinit ice wait lucid
zinit light djui/alias-tips

zinit_omz_completion_plugin httpie

# }}} Functions, aliases and completions

# Navigation {{{
alias cdc='code cd'
alias cdn='notes cd'
alias mydiraction_dispatch=_diraction-dispatch
zinit ice wait \
  cp'__diraction-dispatch -> _mydiraction-dispatch' \
  atload'diraction create code ~/Code' \
  atload'diraction create notes ~/Nextcloud/Заметки' \
  lucid
zinit light AdrieanKhisbe/diractions
# }}} Navigation

# Visual {{{

zstyle :prompt:pure:prompt:success color green
zinit ice pick'async.zsh' src'pure.zsh'
zinit light sindresorhus/pure

zinit ice wait lucid
zinit light ael-code/zsh-colored-man-pages

# }}} Visual

# chruby {{{

# When Vim starts, it runs `zsh -lc env` and needs to see Ruby `bin` directories in `$PATH` there, so run `chruby`
# synchronously, when `env` command is run. When `chruby` is run asynchronously, `zsh -lc env` won't have `chruby` paths
# in its output.
CHRUBY_WAIT=$(echo "$ZSH_EXECUTION_STRING" | grep -q '^(\?env\b' || echo 'wait')

zinit ice ${CHRUBY_WAIT} atload'chruby ruby-2.7' lucid
zinit snippet /usr/local/opt/chruby/share/chruby/chruby.sh

# }}} chruby

# Syntax highlighting, to be loaded last, also atinit'' executes callbacks for completions {{{
export ZSH_HIGHLIGHT_HIGHLIGHTERS=(main brackets cursor line pattern root)
zinit ice wait atinit'zicompinit; zicdreplay' lucid
zinit light zsh-users/zsh-syntax-highlighting
# }}} Syntax highlighting, to be loaded last, also atinit'' executes callbacks for completions

# Needs to be loaded after zsh-syntax-highlighting {{{
zinit ice wait atload'_zsh_autosuggest_start' lucid
zinit light zsh-users/zsh-autosuggestions
# }}} Needs to be loaded after zsh-syntax-highlighting
