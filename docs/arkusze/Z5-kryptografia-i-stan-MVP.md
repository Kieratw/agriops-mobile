# Z5 — Kryptografia i stan MVP AgriOps Mobile

Materiał opisuje stan gałęzi `feat/mobile-mvp` (commit 5cf4ca8).

## 1.1 Kryptografia w aplikacji — slajdy 11–12

| Miejsce | Zadanie | Co jest teraz (plik i linia) | Klucz — skąd i gdzie | Problem | Decyzja i źródło |
| --- | --- | --- | --- | --- | --- |
| K1. Szkice próbek i obserwacji oraz raporty terminala | Poufność i integralność danych offline | `secureDrafts.ts:109`, `:139`, `:195`. Małe rekordy JSON są szyfrowane przez SecureStore. Sprawdzona implementacja Androida używa AES-256-GCM i zapisuje IV przy szyfrogramie. | SecureStore generuje klucz przez Android Keystore. Aplikacja używa go za pośrednictwem biblioteki. | Szkice zawierają dokładny GPS. Lokalne raporty giną po usunięciu aplikacji i obecnie nie mają synchronizacji. | Zachować małe szkice w SecureStore. Po wysłaniu usuwać kopię roboczą. Przy większych zbiorach najpierw określić limit i czas przechowywania. [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) · [Android Keystore](https://developer.android.com/privacy-and-security/keystore) |
| K2. Parowanie terminala QR | Potwierdzenie, że serwer wydał żądanie i właściciel zatwierdził właściwy terminal | `TerminalScreen.tsx:313`. Telefon tworzy osobny sekret z 32 losowych bajtów. `TerminalPairingService.cs:33–41, 123–136` w backendzie generuje kod QR, zapisuje jego HMAC, ustala ważność 5 minut i weryfikuje sekret telefonu. | Kod QR i sekret telefonu pochodzą z generatorów kryptograficznych. Klucz HMAC pochodzi z konfiguracji serwera (`AuthTokenService.cs:12–34`). Na telefonie SecureStore chroni stan parowania i token sesji. | Zdjęcie QR może ujawnić kod w czasie jego ważności. Dostęp zależy także od potwierdzenia właściciela i kontroli uprawnień w API. | Zachować parowanie online przez HTTPS z krótką ważnością i porównaniem numeru w webie. Przygotować test wygaśnięcia, ponownego użycia po zakończeniu oraz odłączenia urządzenia. [Android App Links](https://developer.android.com/training/app-links) |
| K3. Zdjęcie do obserwacji | Poufność pliku roboczego | `FieldObservations.tsx:158–166` przyjmuje URI z pickera. `FieldObservations.tsx:234–257` próbuje usunąć plik roboczy przy odrzuceniu lub po wysłaniu. | Plik roboczy korzysta z prywatnego cache Androida. Aplikacja nie zarządza osobnym kluczem dla tego pliku. | Po przerwaniu procesu kopia robocza może zostać w cache. Szkic tekstu i GPS nie przywraca zdjęcia po restarcie. | Na MVP zachować offline tekst i GPS oraz sprawdzić sprzątanie osieroconych kopii. Jeśli później potrzebna będzie kolejka zdjęć, zapisywać zaszyfrowane pliki AES-GCM w prywatnym katalogu, z kluczem w Keystore, świeżym IV dla każdego szyfrowania i usunięciem po wysłaniu. [Android Keystore](https://developer.android.com/privacy-and-security/keystore) |

**Zakres offline.** Zachowujemy punkty próbek, notatkę i pozycję obserwacji oraz roboczy raport przypisanej pracy. Użytkownik wysyła dane, gdy wróci zasięg i API je obsługuje. Historię gospodarstwa, zapisane zdjęcia i kafelki mapy pobieramy na żądanie. Hasło służy do logowania i pozostaje w pamięci formularza. Token terminala umożliwia ponowne uwierzytelnienie po odzyskaniu sieci.

## 1.2 Kategorie błędów

Przegląd objął kod TypeScript mobilki, natywną implementację zainstalowanego SecureStore oraz wskazane klasy backendu odpowiedzialne za parowanie, tokeny i hasła.

| Kategoria | Wynik | Jak szukaliśmy |
| --- | --- | --- |
| Klucz w kodzie | Sprawdzone, brak w analizowanych ścieżkach. | Sprawdzono opcje SecureStore, tworzenie klucza przez `KeyGenerator` i odczyt `HashSecret` z konfiguracji backendu. |
| Przestarzały algorytm lub tryb | Sprawdzone, brak w analizowanych ścieżkach. | W `AESEncryptor.kt` sprawdzono `AES/GCM/NoPadding`. W kodzie parowania sprawdzono HMAC-SHA-256. |
| Przewidywalna losowość | Sprawdzone, brak w generowaniu sekretów parowania. | Wyszukano `Math.random` i sprawdzono wywołania `getRandomBytesAsync(32)`, `RandomNumberGenerator.Fill` i `GetInt32`. |
| Powtarzane wartości jednorazowe | Sprawdzone, brak stałego lub ręcznie powtarzanego IV. | W `AESEncryptor.kt:84–88` sprawdzono inicjalizację szyfru dla każdego zapisu oraz odczyt IV z parametrów GCM. |
| Hasło jako zwykły skrót | Sprawdzone, brak w implementacji haszowania haseł. | `PasswordHasher.cs:17–18, 38` używa PBKDF2-HMAC-SHA-256 z losową solą i weryfikuje wynik według parametrów zapisu. |
| Szyfrowanie bez integralności | Sprawdzone, brak w ścieżce SecureStore. K3 opisuje osobny przypadek pliku bez szyfrowania na poziomie aplikacji. | Sprawdzono GCM i odczyt znacznika uwierzytelniającego w `AESEncryptor.kt:99–134`. |

## 2. Stan aplikacji i plan — slajd 13

| Obszar | Status | Największe ryzyko |
| --- | --- | --- |
| Funkcje (MVP) | Logowanie, mapa, obserwacje, próbki i tryb terminala są w kodzie. | Raport terminala pozostaje lokalny. Brakuje ścieżki wysłania i zatwierdzenia tego raportu w AgriOps. |
| Build z repozytorium | Repo zawiera konfigurację Android development build. Świeży build z czystego checkoutu do potwierdzenia. | Demo zależy od odtwarzalnego buildu, konfiguracji API i działających App Links. |
| Model zagrożeń | [Model v1](../threat-model/threat-model-v1.md) istnieje. Scenariusze nadal mają status do weryfikacji. | Brak dowodu z urządzenia dla odwołania sesji terminala i utraty telefonu. |
| Uprawnienia | Kamera, lokalizacja i powiadomienia mają opisane zastosowania. | Odmowa zgody lub cofnięcie jej w ustawieniach może przerwać ścieżkę terenową. |
| Przechowywanie danych | Dokumentacja Z4 na gałęzi `feat/mobile-mvp` i SecureStore są w repo. Android ma `allowBackup: false` w konfiguracji. | Plik zdjęcia w cache po przerwaniu procesu. Czyszczenie sesji i szkiców wymaga testu na urządzeniu. |
| Kryptografia | AES-GCM w SecureStore oraz losowe sekrety i HMAC po stronie parowania sprawdzono w źródłach. | Biometria osłania widok właściciela. Aktywna sesja sieciowa pozostaje dostępna dla klienta API w procesie aplikacji. |

**Werdykt MVP — warunkowo.** Można pokazać pracę właściciela, parowanie i lokalny zapis pracy terminala, ale pełny scenariusz wymaga przesłania raportu terminala i zatwierdzenia go przez właściciela.

### Plan do zajęć 6

| Zadanie | Kto | Termin | Jak sprawdzimy |
| --- | --- | --- | --- |
| Podłączyć wysłanie raportu terminala i zatwierdzenie w webie. | Wojciech Kierat | Przed zajęciami 6 | Przydzielone zlecenie przechodzi od startu do zatwierdzenia. Ponowienie wysyłki daje jeden raport. API odrzuca raport dla obcego zlecenia. |
| Zbudować APK z czystego checkoutu i sprawdzić parowanie. | Wojciech Kierat | Przed zajęciami 6 | Zapisać commit i wynik buildu. Na Androidzie sprawdzić App Link, porównanie numeru, wygaśnięcie QR i odłączenie terminala. |
| Sprawdzić szkice, czyszczenie i cache na Androidzie. | Błażej Sztefka | Przed zajęciami 6 | Zapisać szkic bez sieci i odczytać po restarcie. Sprawdzić wylogowanie, reinstalację oraz zdjęcie po przerwaniu formularza. Dopisać wyniki do dokumentacji Z4. |
| Przejść przypadki odmowy uprawnień i uzupełnić dowody w modelu zagrożeń. | Błażej Sztefka | Na zajęcia 6 | Udokumentować odmowę kamery, lokalizacji i powiadomień oraz wynik sprawdzenia odwołania sesji terminala. |

Przydział zadań jest propozycją na podstawie podziału ról opisanego w repozytorium. Statusy wynikają z przeglądu kodu i dokumentacji.
