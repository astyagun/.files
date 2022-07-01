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
ctrl-j:next-history
ctrl-k:previous-history
ctrl-n:down
ctrl-p:up
EOF
)
FZF_PREVIEW_BAT_OPTIONS=$(cat <<-EOF | tr "\n" ' '
--style=plain
--color=always
EOF
)
FZF_PREVIEW_OPTION_VALUE=$(cat <<-EOF | tr "\n" ' '
[[ \$(file --mime {}) =~ binary ]] && echo {} is a binary file
|| [ -d {} ] && tree -C {}
|| (bat $FZF_PREVIEW_BAT_OPTIONS {} || head -n\$FZF_PREVIEW_LINES {}) 2> /dev/null
| head -500
EOF
)
FZF_PREVIEW_OPTION="--preview '$FZF_PREVIEW_OPTION_VALUE'"

export FZF_ALT_C_OPTS="--preview 'tree -C {} | head -100'"
export FZF_CTRL_R_OPTS="--no-preview"
export FZF_DEFAULT_OPTS="--reverse --history $HOME/.local/share/fzf-history $FZF_BIND_OPTION $FZF_PREVIEW_OPTION"
