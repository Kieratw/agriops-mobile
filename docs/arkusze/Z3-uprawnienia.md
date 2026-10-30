# Z3 — Tabela uprawnień AgriOps Mobile

| Uprawnienie / mechanizm | Po co? | Kiedy prosimy? | Co przy odmowie? |
| --- | --- | --- | --- |
| Aparat — `CAMERA` | Zdjęcie obserwacji i skanowanie QR | Po wybraniu aparatu lub skanera QR | Można wybrać zdjęcie z galerii; skanowanie QR niedostępne, pozostałe funkcje działają. |
| Lokalizacja — `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` | Zapis pozycji próbki lub obserwacji | Po kliknięciu „Pobierz lokalizację” | Ręczne wskazanie punktu na mapie. Przy zgodzie przybliżonej pokazujemy ograniczoną dokładność. |
| Bluetooth — `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` (Android 12+) | Wyszukanie ESP32, połączenie i odbiór danych próbki | Po kliknięciu „Połącz z ESP32” | Brak obsługi ESP32; możliwość ręcznego wpisania danych próbki. |
| Powiadomienia — `POST_NOTIFICATIONS` (Android 13+) | Przypomnienie o niedokończonej próbce | Przy włączaniu przypomnień | Aplikacja działa bez powiadomień. |
| Galeria — systemowy Photo Picker | Dodanie wybranego zdjęcia, bez dostępu do całej galerii | Po kliknięciu „Dodaj z galerii” | Anulowanie pozostawia formularz bez zdjęcia. |
| Internet — `INTERNET` | API, podkład Geoportalu i zasoby Leaflet | Bez okna zgody użytkownika | Brak standardowej odmowy; przy braku sieci komunikat i możliwość ponowienia. |

Aparat, lokalizacja, Bluetooth, powiadomienia i wybór zdjęć są planowane. Tabela opisuje ich docelowe zachowanie, a testy odmowy pozostają do wykonania. Obecna mapa korzysta z Geoportalu; przybliżenie do granic pól nie wymaga GPS. Google Maps nie jest używane.

## Co trafia do zbudowanej aplikacji?

Sprawdzono istniejący scalony manifest wersji debug, razem z wpisami dodanymi przez biblioteki.

| Uprawnienia znalezione w buildzie | Wniosek |
| --- | --- |
| `INTERNET` | Potrzebne do API i mapy. |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` — do Androida 12L / API 32 | Dodawane także przez Expo FileSystem. Obecne funkcje ich nie potrzebują; do usunięcia po sprawdzeniu zależności. |
| `SYSTEM_ALERT_WINDOW`, `VIBRATE` | Są w manifeście, ale funkcje AgriOps ich obecnie nie wykorzystują. Do przeglądu przed wydaniem. |
| `ACCESS_NETWORK_STATE`, `CHANGE_WIFI_MULTICAST_STATE`, `ACCESS_LOCAL_NETWORK` | Wpisy bibliotek i narzędzi deweloperskich. Sprawdzić, które pozostają potrzebne w wersji docelowej. |
| `pl.agriops.mobile.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Wewnętrzne zabezpieczenie AndroidX; bez prośby o zgodę użytkownika. |

W tym buildzie nie ma jeszcze uprawnień aparatu, GPS, Bluetooth ani powiadomień. Zbędne wpisy nie zostały jeszcze usunięte.

## Co możemy zastąpić pickerem lub ograniczyć?

| Funkcja | Prostszy lub ograniczony dostęp |
| --- | --- |
| Galeria | Photo Picker — dostęp tylko do wybranego zdjęcia zamiast całej galerii. |
| Lokalizacja | Tylko podczas używania funkcji; do orientacji wystarczy pozycja przybliżona, a dokładny punkt próbki można wskazać ręcznie. |
| Bluetooth | Przy wdrożeniu rozważyć systemowy wybór i parowanie ESP32 przez Companion Device Manager zamiast samodzielnego skanowania. |
