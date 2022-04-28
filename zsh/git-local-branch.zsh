# Widget and keybinding to select local Git branch

HEIGHT=8

function git-local-branch() {
  LBUFFER="${LBUFFER}$(git branch | grep -v '^*' | tr -d ' ' | fzf --no-preview --height=$HEIGHT)"
  local ret=$?
  zle reset-prompt
  return $ret
}

zle -N git-local-branch

bindkey -M emacs '^X^B' git-local-branch
