# Source: https://github.com/zdharma-continuum/zinit/issues/504

function _fix-pzt-module() {
  if [[ ! -f ._zinit/teleid ]] then return 0; fi
  if [[ ! $(cat ._zinit/teleid) =~ "^PZT::.*" ]] then return 0; fi
  local PZTM_NAME=$(cat ._zinit/teleid | sed -n 's/PZT::modules\///p')
  git clone --quiet --no-checkout --depth=1 --filter=tree:0 https://github.com/sorin-ionescu/prezto
  cd prezto
  git sparse-checkout set --no-cone modules/$PZTM_NAME
  git checkout --quiet
  cd ..
  local file
  for file in prezto/modules/$PZTM_NAME/*~(.gitignore|*.plugin.zsh)(D); do
    local filename="${file:t}"
    echo "Copying $file to $(pwd)/$filename..."
    cp -R $file $filename
  done
  rm -rf prezto
}

function _fix-omz-plugin() {
    [[ -f ./._zinit/teleid ]] || return 1
    local teleid="$(<./._zinit/teleid)"
    local pluginid
    for pluginid (${teleid#OMZ::plugins/} ${teleid#OMZP::}) {
      [[ $pluginid != $teleid ]] && break
    }
    (($?)) && return 1
    print "Fixing $teleid..."
    git clone --quiet --no-checkout --depth=1 --filter=tree:0 https://github.com/ohmyzsh/ohmyzsh
    cd ./ohmyzsh
    git sparse-checkout set --no-cone /plugins/$pluginid
    git checkout --quiet
    cd ..
    local file
    for file (./ohmyzsh/plugins/$pluginid/*~(.gitignore|*.plugin.zsh)(D)) {
      print "Copying ${file:t}..."
      cp -R $file ./${file:t}
    }
    rm -rf ./ohmyzsh
}
