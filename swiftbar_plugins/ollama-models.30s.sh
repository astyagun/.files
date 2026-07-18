#!/usr/bin/env bash

# SwiftBar plugin to unload (stop) loaded Ollama models
#
# <xbar.title>Ollama model unloader</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.author>Anton Styagun</xbar.author>
# <xbar.desc>Show loaded Ollama models and allow unloading them</xbar.desc>
# <xbar.dependencies>Ollama</xbar.dependencies>
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideLastUpdated>true</swiftbar.hideLastUpdated>
# <swiftbar.hideDisablePlugin>true</swiftbar.hideDisablePlugin>
# <swiftbar.hideSwiftBar>true</swiftbar.hideSwiftBar>

# How long (in seconds) to wait for a model to actually disappear after issuing a stop command
WAIT_TIMEOUT=10

# If the Ollama macOS app is not running, bail out immediately. In display mode show a struck-through "o".
if ! pgrep -q "Ollama" &>/dev/null; then
  if [[ -z "$1" ]]; then
    echo "ø"
    echo '---'
    echo 'Refresh | refresh=true'
  fi
  exit 0
fi

LOADED_MODELS=$(ollama ps 2>/dev/null | ruby -ane 'puts $F[0] if $. > 1 && !$F.empty?')

# Poll ollama ps (skipping the header line) until the given fixed string no longer matches, or timeout
wait_for_unload() {
  local pattern="$1"
  local _w=$WAIT_TIMEOUT
  while ollama ps 2>/dev/null | tail -n +2 | grep -qF "$pattern" && [[ $_w -gt 0 ]]; do
    sleep 1
    ((_w--))
  done
}

if [[ "$1" = "unload_all" ]]; then
  echo "$LOADED_MODELS" | while IFS= read -r m; do ollama stop "$m"; done
  wait_for_unload ""
  exit 0
fi

if [[ "$1" = "unload" ]]; then
  ollama stop "$2"
  wait_for_unload "${2}"
  exit 0
fi

if [[ -n "$LOADED_MODELS" ]]; then
  echo "O | sfsymbols=O"
  echo '---'
  echo "Unload All | bash='$0' param1=unload_all terminal=false refresh=true"
  echo '---'
  while IFS= read -r MODEL_NAME; do
    echo "Unload ${MODEL_NAME} | bash='$0' param1=unload param2=${MODEL_NAME} terminal=false refresh=true"
  done <<< "$LOADED_MODELS"
else
  echo "o | sfsymbols=o"
fi

echo '---'
echo 'Refresh | refresh=true'
