// google-services.json / GoogleService-Info.plist are gitignored, so EAS can't
// upload them — they arrive as file env vars whose value is a path on the builder.
const { expo } = require("./app.json");

module.exports = {
  ...expo,
  android: {
    ...expo.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? expo.android.googleServicesFile,
  },
  ios: {
    ...expo.ios,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_PLIST ?? expo.ios.googleServicesFile,
  },
};
