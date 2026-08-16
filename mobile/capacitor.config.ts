import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pedro.fragmentos",
  appName: "Fragmentos",
  webDir: "dist",
  android: {
    // O feed é edge-to-edge: o WebView pinta atrás da barra de status.
    backgroundColor: "#08080a",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_fragmentos",
      iconColor: "#2dd4bf",
    },
  },
};

export default config;
