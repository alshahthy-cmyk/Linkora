const baseConfig = require("./app.json").expo;

const arm64Only = process.env.LINKORA_ANDROID_ARCH === "arm64";

function withBuildProperties(plugins) {
  return plugins.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== "expo-build-properties") return plugin;

    return [
      plugin[0],
      {
        ...plugin[1],
        android: {
          ...plugin[1]?.android,
          ...(arm64Only ? { buildArchs: ["arm64-v8a"] } : {}),
        },
      },
    ];
  });
}

module.exports = () => ({
  ...baseConfig,
  plugins: withBuildProperties(baseConfig.plugins ?? []),
});
