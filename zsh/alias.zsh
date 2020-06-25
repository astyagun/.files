# Docker
alias de='dkce $(dkc-executable-container)'
alias ded='dkce --env RAILS_ENV=development $(dkc-executable-container)'
alias det='dkce --env RAILS_ENV=test $(dkc-executable-container)'
alias dksyn='docker-sync'
alias dksynr='dksyn stop && dksyn start'
alias down='dkcd; dksyn clean'
alias dr='dkce ruby'
alias ds='dkce spring'
alias start='dksyn start &; dkcU &; wait'
alias stop='dksyn stop &; dkcx &; wait'
alias up='dksyn start; dkcU'

# Rails in Docker
alias bundle='de bundle'
alias cucumber='det cucumber'
alias rails='de rails'
alias rspec='det rspec'
alias teaspoon='det teaspoon'
alias thor='de thor'
function rake() {
  docker-compose exec -e COLUMNS="$(tput cols)" -e LINES="$(tput lines)" "$(dkc-executable-container)" rake "$@"
}
function rspec-changed {
  if [ $# -eq 0 ] || [ "$1" = '-h' ] || [ "$1" = '--help' ]; then
    echo 'usage: rspec-changed <commit-ish>'
    echo
    echo 'Run RSpec tests changed in <commit-ish>'
  else
    FILES_LIST=$(git diff-tree --no-commit-id --name-only -r "$@" \
      | grep -e '^spec' \
      | xargs ls 2>/dev/null \
      | grep '_spec\.rb$')
    echo Running changed RSpec files:
    echo "$FILES_LIST" | xargs -I% echo "- %"
    echo "$FILES_LIST" | xargs docker-compose exec -T "$(dkc-executable-container)" ./bin/rspec
  fi
}
function cucumber-changed {
  if [ $# -eq 0 ] || [ "$1" = '-h' ] || [ "$1" = '--help' ]; then
    echo 'usage: cucumber-changed <commit-ish>'
    echo
    echo 'Run Cucumber tests changed in <commit-ish>'
  else
    FILES_LIST=$(git diff-tree --no-commit-id --name-only -r "$@" \
      | grep -e '^features' \
      | xargs ls 2>/dev/null \
      | grep '\.feature$')
    echo Running changed Cucumber files:
    echo "$FILES_LIST" | xargs -I% echo "- %"
    echo "$FILES_LIST" | xargs docker-compose exec -T "$(dkc-executable-container)" ./bin/cucumber
  fi
}

# Git
alias grr='git rerebase'
alias gbP='git branch-purge'

# Ping & trace
alias -g wr='10.0.1.1'
alias -g pc='10.0.1.2'
alias -g ya='77.88.21.3'
alias -g ga='8.8.8.8'
alias pingg='ping google.com'
alias pingy='ping ya.ru'
alias mtrga='sudo mtr --curses ga'
alias mtrya='sudo mtr --curses ya'
alias dscf='dscacheutil -flushcache'
alias _rndc='sudo rndc -p54 -s::1'
alias _killdns='sudo kill -HUP `pidof mDNSResponder`'

# Utils
alias findswp="find ./ -type f -name \".*.sw[op]\""
alias rmswp="findswp X rm"
# Show biggest files in `tmutil compare` output
# "+ 123M ..." -> "1M + 123M ..."
alias tmutil-compare-sort="sed -E 's/^([+-\!] [0-9\.]+)([A-Z])/1\2 \1\2/' | sort -h -k 1,1 -k 3,3g"
alias brewu='brew update && brew upgrade && brew cleanup'

# -g utils
alias -g M='| more'
alias -g L='| less'
alias -g H='| head'
alias -g T='| tail'
alias -g G='| grep'
alias -g X='| xargs'
alias -g C='| strip-colors'
alias -g LL="2>&1 | less"
alias -g NE="2> /dev/null"
alias -g NUL="> /dev/null 2>&1"
alias -g GR='$(git rev-parse --show-toplevel)' # Git root
