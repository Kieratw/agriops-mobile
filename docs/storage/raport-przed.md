# D2 — Raport „przed” — co widać na urządzeniu

Stan sprawdzony przed zamknięciem kanałów i ujednoliceniem polityki magazynów lokalnych (na bazie przeglądu kodu, konfiguracji Androida oraz zachowania bibliotek):

| Miejsce | Co znaleziono | Ryzyko |
| --- | --- | --- |
| `SecureStore` (`agriops.terminal.v1`) | Zapis tokenu terminala i sekretu parowania przez `SecureStore.setItemAsync` bez jawnego parametru `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`. | Średnie |
| Pamięć formularzy (`FieldObservations`, próbki, raporty) | Szkice obserwacji, punktów próbek gleby oraz raportów pracy istniały wyłącznie w niezabezpieczonym stanie ulotnym lub nie były powiązane z czyszczeniem przy wylogowaniu. | Średnie |
| Prywatny katalog `cache/ImagePicker` | Pliki tymczasowe tworzone przez `expo-image-picker` podczas wykonywania zdjęcia aparatem lub wyboru z systemowego Photo Pickera. Konfiguracja ma `exif: false` i `allowBackup: false`. | Średnie |
| `WebView` (`react-native-webview`) | Mapa używa `incognito`, `domStorageEnabled={false}`, `sharedCookiesEnabled={false}` i `allowFileAccess={false}`; sesja API nie trafia do `WebView`. | Niskie |
| Logi systemowe (`logcat`) | Klient API (`agriOpsApi.ts`, `terminalApi.ts`) nie loguje nagłówków `Authorization`, ciasteczek, haseł ani współrzędnych GPS do konsoli. | Niskie |
| Kopia zapasowa Androida (`AndroidManifest.xml`) | Flaga `android:allowBackup="false"` wyłącza kopię zapasową katalogu aplikacji w chmurze i przez `adb backup`. | Niskie |
