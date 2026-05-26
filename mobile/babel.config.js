module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-worklets/plugin MUST be last. In Reanimated 4.x the
    // worklets transform was extracted from reanimated into its own package.
    plugins: ["react-native-worklets/plugin"],
  };
};
