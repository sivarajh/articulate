// The scoring engine, prompts and drills live in ../src/lib and are shared with the web
// app. Tell Metro to watch that folder so `@core/...` imports (see tsconfig.json) resolve.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../src/lib')];

module.exports = config;
