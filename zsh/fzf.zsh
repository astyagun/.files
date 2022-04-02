# Remap Ctrl+T from fzf back to original
bindkey -M emacs '^X^T' fzf-file-widget
bindkey -M emacs '^T' transpose-chars

# See `brew info fzf` for installation instructions
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh
