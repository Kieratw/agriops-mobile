# Z5 — Kryptografia i stan MVP AgriOps Mobile

Stan z telefonu Xiaomi, Android ARM64, wersja 0.1.0 (versionCode 1). APK zaktualizowano 13.11.2026 o 11:39. SHA-256 jest zgodny z lokalnym plikiem `AgriOps-Mobile-arm64-Wylogowanie-Terminala.apk`. Zachowanie funkcji opisano na podstawie lokalnego drzewa źródeł opartego na `e901d8b` i zawierającego dodatkowe zmiany robocze. Pełny scenariusz na telefonie pozostaje do sprawdzenia.

## 1.1 Kryptografia w aplikacji — slajdy 11–12

| Miejsce | Zadanie | Co jest teraz (plik i linia) | Klucz — skąd i gdzie | Problem | Decyzja i źródło |
| --- | --- | --- | --- | --- | --- |
| K1. Szkice próbek i obserwacji | Poufność i integralność danych offline | `secureDrafts.ts` zapisuje małe rekordy JSON przez SecureStore. | Klucz w Android Keystore. | Szkice zawierają GPS i mogą zniknąć po reinstalacji. | Zachować małe szkice w SecureStore i sprawdzić usuwanie przy wylogowaniu. [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) |
| K2. Parowanie terminala QR | Potwierdzenie, że serwer wydał żądanie i właściciel zatwierdził właściwy terminal | `TerminalScreen.tsx:228`. Telefon tworzy osobny sekret z 32 losowych bajtów. `TerminalPairingService.cs:33–41, 123–136` w backendzie generuje kod QR, zapisuje jego HMAC, ustala ważność 5 minut i weryfikuje sekret telefonu. | Kod QR i sekret telefonu pochodzą z generatorów kryptograficznych. Klucz HMAC pochodzi z konfiguracji serwera (`AuthTokenService.cs:12–34`). Na telefonie SecureStore chroni stan parowania i token sesji. | Zdjęcie QR może ujawnić kod w czasie jego ważności. Dostęp zależy także od potwierdzenia właściciela i kontroli uprawnień w API. | Zachować parowanie online przez HTTPS z krótką ważnością i porównaniem numeru w webie. Przygotować test wygaśnięcia, ponownego użycia po zakończeniu oraz odłączenia urządzenia. [Android App Links](https://developer.android.com/training/app-links) |
| K3. Zdjęcie do obserwacji | Poufność pliku roboczego | `FieldObservations.tsx:154–180` przyjmuje URI z pickera. `FieldObservations.tsx:244–268` próbuje usunąć plik roboczy przy odrzuceniu lub po wysłaniu. | Plik roboczy korzysta z prywatnego cache Androida. Aplikacja nie zarządza osobnym kluczem dla tego pliku. | Po przerwaniu procesu kopia robocza może zostać w cache. Szkic tekstu i GPS nie przywraca zdjęcia po restarcie. | Na MVP zachować offline tekst i GPS oraz sprawdzić sprzątanie osieroconych kopii. Jeśli później potrzebna będzie kolejka zdjęć, zapisywać zaszyfrowane pliki AES-GCM w prywatnym katalogu, z kluczem w Keystore, świeżym IV dla każdego szyfrowania i usunięciem po wysłaniu. [Android Keystore](https://developer.android.com/privacy-and-security/keystore) |

**Zakres offline.** Zachowujemy punkty próbek, notatkę i pozycję obserwacji. Użytkownik wysyła dane, gdy wróci zasięg. Historię gospodarstwa, zapisane zdjęcia i kafelki mapy pobieramy na żądanie. Hasło służy do logowania i pozostaje w pamięci formularza. Token terminala umożliwia ponowne uwierzytelnienie po odzyskaniu sieci.

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

[Stan aplikacji i plan do zajęć 6](Z5-plan-do-zajec-6.md)
