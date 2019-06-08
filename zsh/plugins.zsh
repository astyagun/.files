# Zsh setup

zplugin ice wait'0' atload'bindkey -M emacs "^P" history-substring-search-up; bindkey -M emacs "^N" history-substring-search-down'
zplugin load zsh-users/zsh-history-substring-search

zplugin ice wait'0'
zplugin load zsh-users/zsh-autosuggestions

zplugin ice wait'0' atload'diraction create code ~/Code'
zplugin load AdrieanKhisbe/diractions

zplugin ice wait'0'
zplugin load zsh-users/zsh-completions


# Integrations

zplugin load akarzim/zsh-docker-aliases


# Syntax highlighting, to be loaded last, also atinit'' executes callbacks for completions
zplugin ice wait'0c' atinit'zpcompinit; zpcdreplay'
zplugin load zsh-users/zsh-syntax-highlighting
