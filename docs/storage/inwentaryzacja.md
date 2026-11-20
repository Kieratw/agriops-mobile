# D1 — Inwentaryzacja danych na urządzeniu

| Dane | Gdzie są teraz | Klasyfikacja | Musi być na urządzeniu? | Docelowe miejsce i opcja |
| --- | --- | --- | --- | --- |
| Token sesji terminala (`agriops.terminal.v1`) | `expo-secure-store` (Android Keystore) | Poufne | Tak — autoryzacja żądań terminala ciągnika po sparowaniu QR | `expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` |
| Sekret i stan otwartej próby parowania QR | `expo-secure-store` (tylko na czas parowania) | Poufne | Tak — odbiór zatwierdzonej sesji z API (`redeem`) | `expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, usuwany po odbiorze lub `410 Gone` |
| Klucz blokady biometrycznej sesji właściciela (`agriops.owner.biometric.v1`) | `expo-secure-store` z wymogiem uwierzytelnienia | Poufne | Tak — opcjonalne odblokowanie aktywnej sesji właściciela | `expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` + `requireAuthentication: true` |
| Sesja właściciela (ciasteczko HTTPOnly API) | Natywny magazyn sesji sieciowej dla żądań HTTPS z `credentials: 'include'` | Poufne | Tak — utrzymanie sesji na czas pracy właściciela | Tylko w natywnym kliencie HTTPS (bez dostępu z WebView), unieważniane na serwerze przy `/api/auth/logout` |
| E-mail i hasło właściciela | Tylko w pamięci komponentu formularza podczas logowania | Poufne | Nie — służą wyłącznie do zalogowania | Brak zapisu na dysku; hasło czyszczone natychmiast po `login()` |
| Lokalny szkic próbki gleby (`agriops.soil.draft.v1.*`) | `expo-secure-store` | Szczególnie wrażliwe | Tak — ochrona punktów GPS/mapy przed utratą zasięgu w polu | `expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, usuwany po wysłaniu, odrzuceniu lub wylogowaniu |
| Lokalny szkic obserwacji pola (`agriops.obs.draft.v1.*`) | `expo-secure-store` | Szczególnie wrażliwe | Tak — zachowanie notatki i pozycji przy błędzie sieci | `expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, usuwany po wysłaniu, odrzuceniu lub wylogowaniu |
| Lokalny szkic raportu pracy terminala (`agriops.terminal.reports.v1`) | `expo-secure-store` | Wewnętrzne | Tak — zapis czasu rozpoczęcia, powierzchni i uwagi w ciągniku | `expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, usuwany przy odłączeniu terminala |
| Tymczasowy plik zdjęcia przed wysyłką (`expo-image-picker`) | Prywatny katalog `cache/` aplikacji w sandboksie Androida | Szczególnie wrażliwe | Tylko chwilowo do zakończenia wysyłki `multipart/form-data` | Prywatny cache aplikacji (`allowBackup="false"`), bez EXIF (`exif: false`), referencja usuwana po wysłaniu |
| Podgląd zapisanych zdjęć obserwacji z API | Pamięć RAM (`data:image/...;base64,...`) | Szczególnie wrażliwe | Nie — pobierany na żądanie z API | Brak zapisu na dysku; odpowiedź API ma `Cache-Control: private, no-store` |
| Lista gospodarstw, pól, granic GeoJSON, upraw i zleceń | Pamięć RAM (`useState`) | Wewnętrzne | Nie — pobierana z API na żądanie | Brak trwałego zapisu lokalnego |
| Kafelki ortofotomapy Geoportalu i skrypt Leaflet | Pamięć procesu `WebView` (`incognito`, `domStorageEnabled={false}`) | Publiczne | Nie — pobierane podczas wyświetlania mapy | Tryb `incognito` w `WebView`, bez trwałego `domStorage` i bez ciasteczek |
