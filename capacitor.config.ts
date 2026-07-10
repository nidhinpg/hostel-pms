import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pavio.app',
  appName: 'Pavio',
  webDir: 'build',
  server: {
    url: 'https://www.pavio.tech',
    cleartext: false
  }
};

export default config;