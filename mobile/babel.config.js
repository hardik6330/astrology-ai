module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./src"],
          alias: { "@": "./src" },
          extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
        },
      ],
      // react-native-worklets/plugin MUST be last. In Reanimated 4.x the
      // worklets transform was extracted from reanimated into its own package.
      "react-native-worklets/plugin",
    ],
  };
};
