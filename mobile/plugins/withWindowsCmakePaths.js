const { withAppBuildGradle } = require('expo/config-plugins');

// Ustawienie przetrwa ponowne wygenerowanie projektu Androida.
module.exports = function withWindowsCmakePaths(config) {
  return withAppBuildGradle(config, (mod) => {
    const marker = '// AgriOps: limit native object paths for Windows Ninja';
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents += `
${marker}
android {
    defaultConfig {
        externalNativeBuild {
            cmake {
                arguments "-DCMAKE_OBJECT_PATH_MAX=250"
            }
        }
    }
}
`;
    }
    return mod;
  });
};
