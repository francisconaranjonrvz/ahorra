module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // reanimated 4 mueve el runtime de worklets a su propio paquete; el plugin
    // debe ir el último de la lista.
    plugins: ['react-native-worklets/plugin'],
  };
};
