bindkey -e
WORDCHARS='*?_-.[]~&;!#$%^(){}<>'

# Redo.
bindkey -M emacs "\e_" redo

# Allow command line editing in an external editor
autoload -Uz edit-command-line
zle -N edit-command-line
# Edit command in an external editor.
bindkey -M emacs "\C-X\C-E" edit-command-line

# Expand command name to full path.
bindkey -M emacs "\ee" expand-cmd-path

# Control-Space expands all aliases, including global
function glob-alias {
  zle _expand_alias
  zle expand-word
  zle magic-space
}
zle -N glob-alias
bindkey -M emacs "\C- " glob-alias

# Display an indicator when completing
function expand-or-complete-with-indicator {
  local indicator

  # This is included to work around a bug in zsh which shows up when interacting
  # with multi-line prompts.
  if [[ -z "$indicator" ]]; then
    zle expand-or-complete
    return
  fi

  print -Pn "$indicator"
  zle expand-or-complete
  zle redisplay
}
zle -N expand-or-complete-with-indicator
bindkey -M emacs "\C-I" expand-or-complete-with-indicator
