// Use require.resolve so Metro worker processes (jest-worker) find the preset
// even when Node's module paths differ from the project root.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [require.resolve("babel-preset-expo")],
    plugins: [require.resolve("react-native-reanimated/plugin")],
  };
};
