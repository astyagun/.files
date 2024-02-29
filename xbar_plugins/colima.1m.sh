#!/usr/bin/env bash

# Simple xbar plugin to monitor Colima VM status
#
# <xbar.title>Colima monitor</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.author>Anton Styagun</xbar.author>
# <xbar.author.github>astyagun</xbar.author.github>
# <xbar.desc>Show status and allow to stop Colima VM</xbar.desc>
# <xbar.dependencies>Colima, Lima</xbar.dependencies>
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideLastUpdated>true</swiftbar.hideLastUpdated>
# <swiftbar.hideDisablePlugin>true</swiftbar.hideDisablePlugin>
# <swiftbar.hideSwiftBar>true</swiftbar.hideSwiftBar>

# Main purpose is to notice if I've forgotten to turn the VM off and be able to do so. Because of that refresh interval
# can be longer, like 1m, and there's no need to detect state of VM "starting or stopping".

ICON_RUNNING='C'
ICON_STOPPED='c'

if [[ -f /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  eval "$(/usr/local/bin/brew shellenv)"
fi

if [[ -S ~/.colima/_lima/colima/ssh.sock ]]; then
  echo "$ICON_RUNNING"
else
  echo "$ICON_STOPPED"
fi
echo '---'
echo 'Refresh | refresh=true'
