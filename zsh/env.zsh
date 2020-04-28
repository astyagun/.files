export EDITOR=$VISUAL
export VISUAL='mvim -f'

export LESS='-F -g -i -M -R -w -X -z-4'

export PATH=$(cat <<-EOF | tr "\n" ':' | sed 's/:*$//g'
$HOME/bin
$HOME/.files/bin
$HOME/Library/Python/3.7/bin
$PATH
EOF
)

export HOMEBREW_NO_ANALYTICS=1
