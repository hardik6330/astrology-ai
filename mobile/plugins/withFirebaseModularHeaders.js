// @react-native-firebase's Swift pods (FirebaseAuth, FirebaseCoreInternal) are
// built as STATIC frameworks here (expo-build-properties ios.useFrameworks =
// "static", required by RNFirebase). A Swift pod built as a static framework
// needs every dependency to emit a module map; the Obj-C interop/util pods
// (GoogleUtilities, *Interop, RecaptchaInterop) don't by default, so `pod
// install` fails with "... which do not define modules". Opting those pods into
// modular headers fixes it.
//
// Expo regenerates ios/Podfile on every prebuild, so inject the lines here
// instead of hand-editing the Podfile (which would be clobbered).
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Obj-C pods (named in the pod-install error) that Firebase's Swift static
// frameworks import. Swift pods must NOT be listed — modular_headers is for
// non-modular Obj-C pods only.
const MODULAR_PODS = [
  'FirebaseCore',
  'GoogleUtilities',
  'FirebaseAuthInterop',
  'FirebaseAppCheckInterop',
  'FirebaseCoreExtension',
  'RecaptchaInterop',
];

const MARKER = '# firebase-modular-headers';
const POST_INSTALL_MARKER = '# firebase-nonmodular-includes';

// Two Firebase+use_frameworks! compile problems, fixed per pod target in
// post_install:
//   1. RNFBApp (Obj-C) imports non-modular React headers (<React/RCTConvert.h>
//      etc). As a framework module, Clang rejects those under
//      -Wnon-modular-include-in-framework-module (as -Werror) → allow them
//      everywhere with CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES.
//   2. RNFBMessaging depends on RNFBApp, so with Clang modules ON the compiler
//      demands React types (RCTPromiseRejectBlock) be @import-ed from
//      RNFBApp's module instead of the textual #import <React/...>, which
//      breaks every RCT_EXPORT_METHOD ("must be imported from module ... before
//      it is required"). Turning modules OFF for just the RNFB* targets makes
//      those React imports resolve textually. Safe: the frameworks still get a
//      module map for consumers (DEFINES_MODULE); this only changes how the
//      RNFB sources themselves are compiled.
const POST_INSTALL_SNIPPET = [
  `    ${POST_INSTALL_MARKER}`,
  '    installer.pods_project.targets.each do |t|',
  '      t.build_configurations.each do |c|',
  "        c.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'",
  "        c.build_settings['CLANG_ENABLE_MODULES'] = 'No' if t.name.start_with?('RNFB')",
  '      end',
  '    end',
].join('\n');

module.exports = function withFirebaseModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfile = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');

      // 1. Modular headers for Firebase's non-modular Obj-C deps.
      if (!contents.includes(MARKER)) {
        const lines = [
          `  ${MARKER}`,
          ...MODULAR_PODS.map((p) => `  pod '${p}', :modular_headers => true`),
        ].join('\n');
        // Insert just after `use_expo_modules!` so the pods are declared inside
        // the app target before autolinking resolves the Firebase pods.
        const anchor = '  use_expo_modules!';
        if (!contents.includes(anchor)) {
          throw new Error('withFirebaseModularHeaders: could not find use_expo_modules! anchor in Podfile');
        }
        contents = contents.replace(anchor, `${anchor}\n${lines}`);
      }

      // 2. Allow non-modular includes in framework modules (RNFBApp headers).
      if (!contents.includes(POST_INSTALL_MARKER)) {
        const anchor = '  post_install do |installer|';
        if (!contents.includes(anchor)) {
          throw new Error('withFirebaseModularHeaders: could not find post_install anchor in Podfile');
        }
        contents = contents.replace(anchor, `${anchor}\n${POST_INSTALL_SNIPPET}`);
      }

      fs.writeFileSync(podfile, contents);
      return config;
    },
  ]);
};
