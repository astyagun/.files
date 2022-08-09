# Docker
alias c=colima
alias ce='LIMA_INSTANCE=colima lima'
alias cs='c start'
alias cx='c stop'
alias de='dkce $(dkc-executable-container)'
alias ded='dkce --env RAILS_ENV=development $(dkc-executable-container)'
alias det='dkce --env RAILS_ENV=test $(dkc-executable-container)'
alias dkc-executable-container='test -f bin/rails && echo spring || echo ruby'
alias down='dkcd; ds clean'
alias ds='docker-sync'
alias dsd='ds clean'
alias dsl='ds logs'
alias dsr='ds restart'
alias dss='ds start'
alias dsw="watch 'docker-sync logs | tail -n40'"
alias dsx='ds stop'
alias start='ds start &; dkcU &; wait'
alias stop='ds stop &; dkcx &; wait'
alias up='ds start; dkcU'

# Ruby and Rails in Docker
alias be='bundle exec'
alias bundle='de bundle'
alias cucumber='det spring cucumber'
alias jekyll='dr jekyll'
alias packwerk='de spring packwerk'
alias rails='de spring rails'
alias rspec='det spring rspec'
alias teaspoon='det spring teaspoon'
alias thor='de spring thor'

function rake() {
  docker compose exec -e COLUMNS="$(tput cols)" -e LINES="$(tput lines)" "$(dkc-executable-container)" rake "$@"
}
function rspec-changed {
  if [ "$1" = '-h' ] || [ "$1" = '--help' ]; then
    echo 'usage: rspec-changed [<commit-ish>]'
    echo
    echo 'Run RSpec tests changed in <commit-ish> or in master..HEAD'
    echo
    echo 'Example: rspec-changed somebranch..HEAD'
  else
    if [ $# -eq 0 ]; then
      COMMITISH="master"
    else
      COMMITISH="$@"
    fi
    FILES_LIST=$(git diff --name-only "$COMMITISH" | grep -e '^spec/.*_spec\.rb$')
    DOCKER_CONTAINER=$(dkc-executable-container)
    SPRING_PREFIX=""
    if [[ "$DOCKER_CONTAINER" == "spring" ]]; then SPRING_PREFIX="spring"; fi

    echo Running changed RSpec files:
    echo "$FILES_LIST" | xargs -I% echo "- %"
    echo "$FILES_LIST" | xargs docker compose exec -T $DOCKER_CONTAINER $SPRING_PREFIX rspec
  fi
}
function cucumber-changed {
  if [ "$1" = '-h' ] || [ "$1" = '--help' ]; then
    echo 'usage: cucumber-changed [<commit-ish>]'
    echo
    echo 'Run Cucumber tests changed in <commit-ish> or in master..HEAD'
    echo
    echo 'Example: cucumber-changed somebranch..HEAD'
  else
    if [ $# -eq 0 ]; then
      COMMITISH="master"
    else
      COMMITISH="$@"
    fi
    FILES_LIST=$(git diff --name-only "$COMMITISH" | grep -e '^features/.*\.feature$')
    DOCKER_CONTAINER=$(dkc-executable-container)
    SPRING_PREFIX=""
    if [[ "$DOCKER_CONTAINER" == "spring" ]]; then SPRING_PREFIX="spring"; fi

    echo Running changed Cucumber files:
    echo "$FILES_LIST" | xargs -I% echo "- %"
    echo "$FILES_LIST" | xargs docker compose exec -T $DOCKER_CONTAINER $SPRING_PREFIX cucumber
  fi
}

# Git
alias cdg='cd $(git-root)'
alias gbP='git branch-purge'
alias grr='git rerebase'

# Ping & trace
alias -g GA='8.8.8.8'
alias -g RA='192.168.0.1'
alias -g YA='77.88.21.3'
alias mtrga='sudo mtr --curses GA'
alias mtrya='sudo mtr --curses YA'
alias pingg='ping google.com'
alias pingr='ping RA'
alias pingy='ping ya.ru'

alias _killdns='sudo kill -HUP `pidof mDNSResponder`'
alias _rndc='sudo rndc -p54 -s::1'
alias dscf='dscacheutil -flushcache'

# Utils
alias brewu='brew update && brew upgrade && brew cleanup'
alias findswp="find ./ -type f -name \".*.sw[op]\""
alias intel="arch -x86_64"
alias rmswp="findswp X rm"
# Show biggest files in `tmutil compare` output
# "+ 123M ..." -> "1M + 123M ..."
alias tmutil-compare-sort="sed -E 's/^([+-\!] [0-9\.]+)([A-Z])/1\2 \1\2/' | sort -h -k 1,1 -k 3,3g"

# -g utils
alias -g L='| less'
alias -g M='| more'

alias -g H='| head'
alias -g T='| tail'

alias -g G='| grep'
alias -g R='| rg'

alias -g X='| xargs'
alias -g C='| strip-colors'

alias -g LL="2>&1 | less"
alias -g NE="2> /dev/null"
alias -g NUL="> /dev/null 2>&1"

alias -g GR='$(git rev-parse --show-toplevel)' # Git root
