#!/usr/bin/env bash

# Simple xbar plugin to control Colima VM

THIS_FILE="$0"

ICON_RUNNING='C'
ICON_STOPPED='c | color=gray'
START_ACTION="Start | shell='$THIS_FILE' param1=start"
STOP_ACTION="Stop | shell='$THIS_FILE' param1=stop"

if [[ -f /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  eval "$(/usr/local/bin/brew shellenv)"
fi

function colima_is_running() {
  [[ -f ~/.lima/colima/qemu.pid ]] && return 0 || return 1
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
echo "$(colima_is_running && echo "$STOP_ACTION" || echo "$START_ACTION")"
