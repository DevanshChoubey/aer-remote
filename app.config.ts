import type { ConfigContext, ExpoConfig } from 'expo/config';

// Release builds must not hold the INTERNET permission; debug builds need it for Metro.
export default ({ config }: ConfigContext): ExpoConfig => {
  const blocked = [...(config.android?.blockedPermissions ?? [])];
  if (process.env.APP_VARIANT === 'release') blocked.push('android.permission.INTERNET');
  return {
    ...config,
    name: config.name ?? 'Aer Remote',
    slug: config.slug ?? 'aer-remote',
    android: { ...config.android, blockedPermissions: blocked },
  };
};
