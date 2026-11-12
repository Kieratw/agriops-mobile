module.exports = ({ config }) => {
  const origin = new URL(process.env.EXPO_PUBLIC_APP_ORIGIN?.trim() || 'https://agriops.pl');
  if (origin.protocol !== 'https:' || origin.port || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('EXPO_PUBLIC_APP_ORIGIN musi być adresem HTTPS domeny bez ścieżki ani portu.');
  }

  return {
    ...config,
    plugins: [...(config.plugins ?? []), 'expo-secure-store'],
    android: {
      ...config.android,
      intentFilters: [
        ...(config.android?.intentFilters ?? []),
        {
          action: 'VIEW',
          autoVerify: true,
          category: ['BROWSABLE', 'DEFAULT'],
          data: [{ scheme: 'https', host: origin.hostname, path: '/terminal/pair' }],
        },
      ],
    },
  };
};
