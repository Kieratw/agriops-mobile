# D3 — Decyzje o magazynie

## Token sesji terminala i sekret parowania (`agriops.terminal.v1`)

- **Po co na urządzeniu:** uwierzytelnianie żądań terminala ciągnika (`Authorization: Terminal <token>`) oraz dokończenie rozpoczętego parowania QR (`redeem`).
- **Klasyfikacja:** poufne.
- **Magazyn:** Android Keystore / iOS Keychain przez `expo-secure-store`.
- **Dostępność:** `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- **Uzasadnienie:** terminal działa na tablecie/telefonie operatora podczas pracy przy odblokowanym ekranie; poświadczenie nie może przechodzić do kopii zapasowej ani na inne urządzenie.
- **Zasady:** 2 (sekrety w magazynie), 3 (świadoma dostępność), 5 (sprzątanie przy odłączeniu / `401`).

## Klucz blokady biometrycznej właściciela (`agriops.owner.biometric.v1`)

- **Po co na urządzeniu:** opcjonalne zablokowanie i ponowne odblokowanie aktywnej sesji właściciela za pomocą biometrii lub poświadczenia ekranu blokady Androida.
- **Klasyfikacja:** poufne.
- **Magazyn:** Android Keystore przez `expo-secure-store` (`keychainService: 'agriops.biometric.v1'`).
- **Dostępność:** `WHEN_UNLOCKED_THIS_DEVICE_ONLY` oraz `requireAuthentication: true` (`setUserAuthenticationRequired(true)`).
- **Uzasadnienie:** klucz kryptograficzny w Keystore wymaga autoryzacji użytkownika w TEE przed odszyfrowaniem; przy braku biometrii lub anulowaniu użytkownik może wylogować sesję i zalogować się ponownie hasłem.
- **Zasady:** 2, 3, 5.
- **Ograniczenie:** w kluczu leży tylko znacznik czasu, a nie sekret sesji. Flaga `locked` w aplikacji ukrywa dane właściciela, ale ciasteczko sesji i klient API pozostają w pamięci procesu. To blokada ekranu aplikacji, nie kryptograficzna ochrona sesji; pełne zamknięcie sesji daje wylogowanie.

## Lokalne szkice terenowe (`agriops.soil.draft.v1.*`, `agriops.obs.draft.v1.*`, `agriops.terminal.reports.v1`)

- **Po co na urządzeniu:** zachowanie punktów pobrania próbek gleby (GPS lub punkt z mapy), notatki obserwacji oraz raportu wykonania pracy ciągnika w razie utraty zasięgu w polu lub restartu aplikacji.
- **Klasyfikacja:** szczególnie wrażliwe (dokładna lokalizacja i opis obserwacji) / wewnętrzne (raport pracy).
- **Magazyn:** `expo-secure-store` (szyfrowane kluczem z Android Keystore) z indeksem kluczy `agriops.draft.index.v1`.
- **Dostępność:** `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- **Uzasadnienie:** szkice mają niewielki rozmiar (JSON z punktami i notatką), więc mogą być szyfrowane bezpośrednio w `SecureStore` bez tworzenia niezaszyfrowanych plików SQLite/AsyncStorage.
- **Zasady:** 1 (minimalizacja), 2 (ochrona danych wrażliwych), 3 (tylko na odblokowanym urządzeniu), 5 (usuwanie po wysłaniu, odrzuceniu i wylogowaniu).

## Dane gospodarstw, pól, dokumentacji i zapisane zdjęcia z API

- **Po co na urządzeniu:** wyświetlenie w bieżącym widoku po pobraniu z API AgriOps.
- **Klasyfikacja:** wewnętrzne (pola, zlecenia) / szczególnie wrażliwe (zdjęcia obserwacji).
- **Magazyn:** wyłącznie pamięć ulotna procesu (RAM); brak zapisu na dysku urządzenia.
- **Dostępność:** tylko w czasie trwania widoku w pamięci aplikacji.
- **Uzasadnienie:** pobrane z API miniaturki zdjęć obserwacji są zamieniane w pamięci na `data:image/...;base64,...` z nagłówkiem `Cache-Control: private, no-store` po stronie serwera, dzięki czemu nie trafiają do niezaszyfrowanego cache obrazów na dysku.
- **Zasady:** 1 (minimalizacja — to, czego nie zapisujemy na dysku, nie wycieknie z pamięci trwałej), 4 (zamknięte kanały).
