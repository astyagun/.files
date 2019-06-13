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
