fx_version 'cerulean'
game 'gta5'

name 'mdt_premium'
author 'OpenAI Assistant'
description 'Premium ESX MDT Tablet (Design-first scaffold)'
version '0.1.0'

ui_page 'web/dist/index.html'

shared_scripts {
  'shared/config.lua'
}

client_scripts {
  'client/main.lua'
}

server_scripts {
  '@oxmysql/lib/MySQL.lua',
  'server/main.lua'
}

files {
  'web/dist/index.html',
  'web/dist/assets/*'
}
