import type { CapacitorConfig } from '@capacitor/cli';

// App id is permanent once a store listing exists; confirm before the first upload.
const config: CapacitorConfig = {
  appId: 'com.tacticallyidle.app',
  appName: 'Tactically Idle',
  webDir: 'dist',
  backgroundColor: '#0f1013',
  ios: { contentInset: 'never', backgroundColor: '#0f1013' },
  android: { backgroundColor: '#0f1013' },
};

export default config;
