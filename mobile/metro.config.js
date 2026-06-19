const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// The shared chart engine lives in ../packages/astrology-core, outside this
// app's root. Metro only bundles files under projectRoot + watchFolders, so add
// the repo root; and since the package imports `astronomy-engine` as a bare
// specifier, point resolution at this app's node_modules so it's found.
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [repoRoot];

config.resolver.assetExts.push('bin');
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(repoRoot, 'node_modules'),
];

module.exports = config;
