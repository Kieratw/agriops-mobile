# Z3 — Tabela uprawnień AgriOps Mobile

| Uprawnienie / mechanizm | Po co? | Kiedy prosimy? | Co przy odmowie? |
| --- | --- | --- | --- |
| Aparat — `CAMERA` | Zdjęcie obserwacji i skanowanie QR | Po wybraniu aparatu lub skanera QR | Można wybrać zdjęcie z galerii; skanowanie QR aparatem niedostępne, można wczytać QR z galerii lub wpisać kod ręcznie. |
| Lokalizacja — `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` | Zapis pozycji próbki lub obserwacji | Po kliknięciu „Pobierz lokalizację” / „Włącz GPS” | Ręczne wskazanie punktu bezpośrednio na mapie pola. Przy zgodzie przybliżonej pokazujemy ograniczoną dokładność. |
| Bluetooth — `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` (Android 12+) | Wyszukanie ESP32, połączenie i odbiór danych próbki | Po kliknięciu „Połącz z ESP32” | Brak obsługi ESP32; możliwość ręcznego wpisania danych próbki. |
| Powiadomienia — `POST_NOTIFICATIONS` (Android 13+) | Przypomnienie o niedokończonej próbce | Przy włączaniu przypomnień w szkicu badania gleby | Aplikacja i zapis szkicu w `SecureStore` działają bez powiadomień. |
| Galeria — systemowy Photo Picker | Dodanie wybranego zdjęcia, bez dostępu do całej galerii | Po kliknięciu „Dodaj z galerii” / „Z galerii” | Anulowanie pozostawia formularz bez zdjęcia. |
| Internet — `INTERNET` | API, podkład Geoportalu i zasoby Leaflet | Bez okna zgody użytkownika | Brak standardowej odmowy; przy braku sieci komunikat, zachowanie szkicu w `SecureStore` i możliwość ponowienia. |

Aparat (`CAMERA`), lokalizacja (`ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION`), powiadomienia (`POST_NOTIFICATIONS` na Androidzie 13+) oraz systemowy Photo Picker są wdrożone w kodzie aplikacji wraz z obsługą odmowy tymczasowej i trwałej (`Linking.openSettings()`). Mapa korzysta z Geoportalu; przybliżenie do granic pól i ręczne wskazanie punktu próbki lub obserwacji na mapie nie wymagają GPS. Google Maps nie jest używane. Bluetooth pozostaje zaplanowany jako rozszerzenie pod ESP32 poza zakresem MVP.

## Co trafia do zbudowanej aplikacji?

Zestawienie wynika z konfiguracji `app.config.js` / `app.json`. Scalony manifest po nowym buildzie (`expo prebuild` / build deweloperski) wymaga jeszcze sprawdzenia, bo biblioteki mogą dodać własne wpisy.

| Uprawnienia w konfiguracji i buildzie | Wniosek |
| --- | --- |
| `INTERNET` | Potrzebne do komunikacji HTTPS z API AgriOps i podkładu mapy Geoportalu. |
| `CAMERA` | Używane podczas wykonywania zdjęcia obserwacji pola oraz skanowania kodu QR terminala ciągnika. |
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | Używane na pierwszym planie przy oznaczaniu pozycji próbki gleby, obserwacji pola oraz pozycji na mapie. |
| `POST_NOTIFICATIONS` | Używane na Androidzie 13+ (API 33+) przy włączaniu przypomnienia o niedokończonym szkicu próbki gleby. |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` | Jawnie zablokowane na liście `android.blockedPermissions` w `app.config.js` / `app.json`. |
| `pl.agriops.mobile.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Wewnętrzne zabezpieczenie AndroidX; bez prośby o zgodę użytkownika. |

## Co możemy zastąpić pickerem lub ograniczyć?

| Funkcja | Prostszy lub ograniczony dostęp |
| --- | --- |
| Galeria | Photo Picker — dostęp tylko do wybranego zdjęcia zamiast całej galerii. |
| Lokalizacja | Tylko podczas używania funkcji; do orientacji wystarczy pozycja przybliżona, a dokładny punkt próbki lub obserwacji można wskazać ręcznie na mapie pola. |
| Bluetooth | Przy wdrożeniu rozważyć systemowy wybór i parowanie ESP32 przez Companion Device Manager zamiast samodzielnego skanowania. |
