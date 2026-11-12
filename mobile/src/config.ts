export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim() ?? '',
  appOrigin: process.env.EXPO_PUBLIC_APP_ORIGIN?.trim() || 'https://agriops.pl',
};
