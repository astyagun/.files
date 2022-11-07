#!/usr/bin/env bash

# Simple xbar plugin to monitor Colima VM status and stop the VM
#
#  <xbar.title>Colima monitor</xbar.title>
#  <xbar.version>v1.0</xbar.version>
#  <xbar.author>Anton Styagun</xbar.author>
#  <xbar.author.github>astyagun</xbar.author.github>
#  <xbar.desc>Show status and allow to stop Colima VM</xbar.desc>
#  <xbar.dependencies>Colima, Lima</xbar.dependencies>

# Main purpose is to notice if I've forgotten to turn the VM off and be able to do so. Because of that refresh interval
# can be longer, like 1m, and there's no need to detect state of VM "starting or stopping".

THIS_FILE="$0"

ICON_RUNNING='C'
ICON_STOPPED='c'
START_ACTION='Stopped'
STOP_ACTION="Stop | shell='$THIS_FILE' param1=stop"

if [[ -f /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  eval "$(/usr/local/bin/brew shellenv)"
fi

if [[ "$1" == 'stop' ]]; then
  colima stop
  exit
fi

if [[ -S ~/.lima/colima/ssh.sock ]]; then
  echo "$ICON_RUNNING"
  echo '---'
  echo 'Refresh | refresh=true'
  echo "$STOP_ACTION"
else
  echo "$ICON_STOPPED"
  echo '---'
  echo 'Refresh | refresh=true'
  echo "$START_ACTION"
fi
