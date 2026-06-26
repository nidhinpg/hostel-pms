import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.hosteloops.pms',
  appName: 'Hosteloops PMS',
  webDir: 'build',
  server: {
    url: 'https://hostel-pms-azure.vercel.app',
    cleartext: true
  }
};
export default config;