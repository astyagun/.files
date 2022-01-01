export EDITOR=$VISUAL
export VISUAL='mvim -f'

export LESS='-F -g -i -M -R -w -X -z-4'

eval "$(/opt/homebrew/bin/brew shellenv)"

# For compiling Ruby gems
# export LDFLAGS="-L/opt/homebrew/opt/ruby/lib"
# export CPPFLAGS="-I/opt/homebrew/opt/ruby/include"

PATH=$(cat <<-EOF | tr "\n" ':' | sed 's/:*$//g'
$HOME/bin
$HOME/.files/bin
/opt/homebrew/lib/ruby/gems/3.0.0/bin
$(echo $HOME/Library/Python/*/bin | sed 's/ /:/g')
/opt/homebrew/opt/ruby/bin
/usr/local/sbin
$PATH
EOF
)
export PATH
