FZF_FD_COMMON_OPTIONS=$(cat <<-EOF | tr "\n" ' '
--color=never
--hidden
--ignore-case
--ignore-file ~/.files/zsh/find.ignore
--no-ignore-vcs
EOF
)

export FZF_DEFAULT_COMMAND="fd $FZF_FD_COMMON_OPTIONS --type f"
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND="fd $FZF_FD_COMMON_OPTIONS --type d ."

FZF_BIND_OPTION=$(cat <<-EOF | sed -e ':a' -e '$!N; s/\n/,/; ta'
--bind ctrl-f:page-down
ctrl-b:page-up
ctrl-d:half-page-down
ctrl-u:half-page-up
ctrl-j:next-history
ctrl-k:previous-history
ctrl-n:down
ctrl-p:up
EOF
)
FZF_PREVIEW_BAT_OPTIONS=$(cat <<-EOF | tr "\n" ' '
--style=numbers
--color=always
$([ -n "$VIM" ] && echo '--theme=GitHub')
EOF
)
FZF_PREVIEW_OPTION="--preview '[[ \$(file --mime {}) =~ binary ]] && echo {} is a binary file || (bat $FZF_PREVIEW_BAT_OPTIONS {} || cat {}) 2> /dev/null | head -500'"

export FZF_DEFAULT_OPTS="--reverse --history $HOME/.local/share/fzf-history $FZF_BIND_OPTION $FZF_PREVIEW_OPTION"
export FZF_ALT_C_OPTS="--preview 'tree -C {} | head -100'"

source /usr/local/opt/fzf/shell/completion.zsh
source /usr/local/opt/fzf/shell/key-bindings.zsh
