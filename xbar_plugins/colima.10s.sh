#!/usr/bin/env bash

# Simple xbar plugin to control Colima VM

ICON_RUNNING=C
ICON_STOPPED='c | color=gray'
THIS_FILE="$0"

eval "$(/opt/homebrew/bin/brew shellenv)"

function colima_is_running() {
  if [[ -f ~/.lima/colima/qemu.pid ]]; then
    return 0
  else
    return 1
  fi
}

function action() {
  if colima_is_running; then
    echo "Stop | shell='$THIS_FILE' param1=stop"
  else
    echo "Start | shell='$THIS_FILE' param1=start"
  fi
}

if [[ "$1" == 'start' ]]; then
  colima start && LIMA_INSTANCE=colima lima sudo sysctl -p
  exit
fi

if [[ "$1" == 'stop' ]]; then
  colima stop
  exit
fi

echo "$(colima_is_running && echo "$ICON_RUNNING" || echo "$ICON_STOPPED")"
echo '---'
echo "$(action)"
