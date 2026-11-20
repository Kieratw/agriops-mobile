import { File, Paths } from 'expo-file-system';

// Usuwa tylko kopie zdjęć utworzone przez picker w prywatnym katalogu cache aplikacji.
export function deleteCachedPhoto(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    if (!uri.startsWith(Paths.cache.uri)) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Czyszczenie jest best-effort; cache i tak jest prywatny dla aplikacji.
  }
}
