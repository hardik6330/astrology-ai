// Dynamic Expo config. Its only job is to source the Firebase config files,
// which are gitignored (so they're NOT uploaded to EAS cloud builds), from EAS
// "file"-type environment variables at build time:
//
//   eas env:create --environment preview --name GOOGLE_SERVICES_INFO_PLIST \
//     --type file --value ./GoogleService-Info.plist
//   eas env:create --environment preview --name GOOGLE_SERVICES_JSON \
//     --type file --value ./google-services.json
//
// At build time EAS materializes each file and sets the env var to its path.
// Everything else still comes from app.json (spread via `config`). The `??`
// fallback to the app.json paths keeps LOCAL builds working, where the files
// sit on disk and no env var is set.
export default ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? config.ios?.googleServicesFile,
  },
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
});
