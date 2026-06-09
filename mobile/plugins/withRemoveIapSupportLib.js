const { withProjectBuildGradle } = require("expo/config-plugins");

// react-native-iap v12's config plugin injects `supportLibVersion = "28.0.0"`
// into the root android/build.gradle. That property was removed in modern Gradle
// (Expo SDK 54 / Gradle 8.14) and, on an AndroidX project, would drag in the
// pre-AndroidX support library — so the build dies on line 1 with:
//   "Could not set unknown property 'supportLibVersion' for root project".
// react-native-iap's own build.gradle only uses supportLibVersion on the legacy
// non-AndroidX path, so the correct value here is "absent". This plugin runs
// AFTER react-native-iap (list it later in app.json) and strips the line back
// out. Remove this once react-native-iap is upgraded to a version (13+) whose
// plugin no longer injects it.
module.exports = function withRemoveIapSupportLib(config) {
  // NOTE: listed BEFORE "react-native-iap" in app.json on purpose — Expo runs
  // same-file mods in reverse plugin order, so being earlier in the array makes
  // this strip run AFTER react-native-iap injects the line.
  return withProjectBuildGradle(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents
      .split("\n")
      .filter((line) => !line.includes("supportLibVersion"))
      .join("\n");
    return cfg;
  });
};
