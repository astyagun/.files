#############
#  general  #
#############

source ~/.files/zsh/env.zsh
source ~/.files/zsh/keyboard.zsh

##################
#  integrations  #
##################

source ~/.files/zsh/fzf.zsh

###########
#  zinit  #
###########

### Added by Zinit's installer
if [[ ! -f $HOME/.zinit/bin/zinit.zsh ]]; then
  print -P "%F{33}▓▒░ %F{220}Installing DHARMA Initiative Plugin Manager (zdharma/zinit)…%f"
  command mkdir -p "$HOME/.zinit"
  command git clone https://github.com/zdharma/zinit "$HOME/.zinit/bin" && \
    print -P "%F{33}▓▒░ %F{34}Installation successful.%f%b" || \
    print -P "%F{160}▓▒░ The clone has failed.%f%b"
fi

source "$HOME/.zinit/bin/zinit.zsh"
autoload -Uz _zinit
(( ${+_comps} )) && _comps[zinit]=_zinit
### End of Zinit's installer chunk

#############
#  plugins  #
#############

source ~/.files/zsh/plugins.zsh

#############
#  aliases  #
#############

source ~/.files/zsh/alias.zsh