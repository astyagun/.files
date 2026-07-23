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

# If the Ollama macOS app is not running, bail out immediately. In display mode show a struck-through "o".
if ! pgrep -q "Ollama" &>/dev/null; then
  if [[ -z "$1" ]]; then
    echo "ø"
    echo '---'
    echo 'Refresh | refresh=true'
  fi
  exit 0
fi

OLLAMA_PS=$(ollama ps 2>/dev/null | tail -n +2 | grep -v '^$')
LOADED_MODELS=$(echo $OLLAMA_PS | ruby -ane 'puts $F[0]')

if [[ "$1" = "unload_all" ]]; then
  echo "$LOADED_MODELS" | while IFS= read -r m; do ollama stop "$m"; done
  exit 0
fi

if [[ "$1" = "unload" ]]; then
  ollama stop "$2"
  exit 0
fi

if [[ -n "$LOADED_MODELS" ]]; then
  if echo "$OLLAMA_PS" | ruby -ane 'puts $F[-1]' | grep -q "Stopping..."; then
    echo "O..."
    (sleep 1 && open "swiftbar://refreshplugin?name=ollama-models") &>/dev/null </dev/null & disown || true
  else
    echo "O"
  fi
  echo "---"
  echo "Unload All | bash='$0' param1=unload_all terminal=false refresh=true"
  echo "---"
  while IFS= read -r MODEL_NAME; do
    echo "Unload ${MODEL_NAME} | bash='$0' param1=unload param2=${MODEL_NAME} terminal=false refresh=true"
  done <<< "$LOADED_MODELS"
else
  echo "o"
fi

echo "---"
echo "Refresh | refresh=true"
