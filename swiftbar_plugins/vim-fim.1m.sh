#!/usr/bin/env bash

# Simple xbar plugin to manage llama-server for VIM FIM status
#
# <xbar.title>Vim FIM server manager</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.author>Anton Styagun</xbar.author>
# <xbar.author.github>astyagun</xbar.author.github>
# <xbar.desc>Show status and allow to start/stop llama-server for Vim FIM</xbar.desc>
# <xbar.dependencies>macOS, launchd service</xbar.dependencies>
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideLastUpdated>true</swiftbar.hideLastUpdated>
# <swiftbar.hideDisablePlugin>true</swiftbar.hideDisablePlugin>
# <swiftbar.hideSwiftBar>true</swiftbar.hideSwiftBar>

ICON_LOADING="..."
ICON_RUNNING="L"
ICON_STOPPED="l"

if [[ -f /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  eval "$(/usr/local/bin/brew shellenv)"
fi

case $1 in
  start)
    /bin/launchctl load ~/Library/LaunchAgents/org.astyagun.vim-fim.plist
    /bin/launchctl start org.astyagun.vim-fim
    exit 0
  ;;
  stop)
    /bin/launchctl unload ~/Library/LaunchAgents/org.astyagun.vim-fim.plist
    exit 0
  ;;
esac

LLAMA_SERVER_SERVICE_LOADED="$([[ $(launchctl list | grep org.astyagun.vim-fim | cut -f1) =~ [0-9]+ ]]; echo $?)"
LLAMA_SERVER_MODEL_LOADED="$([[ $(curl -fs http://localhost:8012/health | jq -r .status) == ok ]]; echo $?)"

if [[ $LLAMA_SERVER_SERVICE_LOADED != "$LLAMA_SERVER_MODEL_LOADED" ]]; then
  echo "$ICON_LOADING | terminal=false refresh=true"
  (sleep 2 && open "swiftbar://refreshplugin?name=vim-fim") &
elif [[ $LLAMA_SERVER_SERVICE_LOADED == 0 && $LLAMA_SERVER_MODEL_LOADED == 0 ]]; then
  echo "$ICON_RUNNING | terminal=false refresh=true bash='$0' param1=stop"
else
  echo "$ICON_STOPPED | terminal=false refresh=true bash='$0' param1=start"
fi
