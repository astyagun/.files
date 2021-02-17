export EDITOR=$VISUAL
export VISUAL='mvim -f'

export LESS='-F -g -i -M -R -w -X -z-4'

PATH=$(cat <<-EOF | tr "\n" ':' | sed 's/:*$//g'
$HOME/bin
$HOME/.files/bin
$(echo $HOME/Library/Python/*/bin | sed 's/ /:/g')
$PATH
EOF
)
export PATH

export HOMEBREW_NO_ANALYTICS=1
