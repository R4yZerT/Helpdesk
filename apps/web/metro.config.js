// Metro config para Expo web + pnpm workspace @helpdesk/shared
// Usa el shared compilado (dist/) y evita resolver shared/src con extensiones .js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Observa el workspace para que Metro siga symlinks pnpm
config.watchFolders = [workspaceRoot];

// Asegura que node_modules del workspace también se resuelvan
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Evita que Metro intente resolver shared/src/*.js (fuente TS con import .js para ESM)
config.resolver.blockList = [
  /shared\/src\/.*/,
];

// Deshabilita package exports para que @helpdesk/shared resuelva via "main" (dist/index.js)
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
