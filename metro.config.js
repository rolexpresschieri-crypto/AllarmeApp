const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: [
      /android[\/\\]app[\/\\]build.*/,
      /android[\/\\]build.*/,
      /android[\/\\]app[\/\\]\.cxx[\/\\].*/,
      /node_modules[\/\\]@react-native[\/\\]gradle-plugin[\/\\].*[\/\\]build.*/,
      /node_modules[\/\\]react-native-screens[\/\\]android[\/\\]\.cxx.*/,
      /node_modules[\/\\]react-native-screens[\/\\]android[\/\\]build.*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
