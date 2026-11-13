# Kryptografia w AgriOps Mobile

Stan z telefonu Xiaomi, Android ARM64, wersja 0.1.0 (versionCode 1). APK zaktualizowano 13.11.2026 o 11:39. SHA-256 jest zgodny z lokalnym plikiem `AgriOps-Mobile-arm64-Wylogowanie-Terminala.apk`. Zachowanie funkcji opisano na podstawie lokalnego drzewa źródeł opartego na `e901d8b` i zawierającego dodatkowe zmiany robocze. Pełny scenariusz na telefonie pozostaje do sprawdzenia.

BAiSM · Zajęcia 5 · React Native / Android

## 1. Parowanie terminala ciągnika przez QR

### 1.1 Kryptografia w aplikacji

| Pole | AgriOps Mobile |
| --- | --- |
| **Zadanie** | Potwierdzić, że właściciel przypisuje do ciągnika właściwy telefon. |
| **Co jest teraz** | Serwer generuje kod ważny 5 minut i zapisuje jego HMAC. Telefon generuje własny sekret z 32 losowych bajtów. Właściciel porównuje numer i zatwierdza urządzenie w webie. |
| **Klucz** | Klucz HMAC jest w konfiguracji serwera. Telefon trzyma sekret parowania i otrzymany token terminala w Expo SecureStore. |
| **Ryzyko** | Zdjęcie QR może ujawnić kod, póki jest ważny. Zatwierdzenie w webie i weryfikacja sekretu telefonu ograniczają skutki ujawnienia kodu. |
| **Decyzja** | Zachować parowanie online przez HTTPS. Na urządzeniu sprawdzić wygaśnięcie kodu, próbę ponownego parowania zakończonym kodem i odłączenie terminala. |

Kod mobilki — TerminalScreen.tsx, wiersz 228 · [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)

### 1.2 Kategorie błędów

| Kategoria | Wynik i sposób sprawdzenia |
| --- | --- |
| Klucz w kodzie | Sprawdzone w ścieżce parowania. Backend pobiera klucz HMAC z konfiguracji. |
| Przewidywalna losowość | Sprawdzone w generatorach parowania. Telefon używa `getRandomBytesAsync`, a serwer `RandomNumberGenerator`. |

## 2. Zdjęcia obserwacji pola przed wysłaniem

### 1.1 Kryptografia w aplikacji

| Pole | AgriOps Mobile |
| --- | --- |
| **Zadanie** | Chronić zdjęcie z obserwacji pola od wybrania lub zrobienia go do momentu wysłania albo odrzucenia. |
| **Co jest teraz** | Picker zwraca URI pliku roboczego. Po wysłaniu i przy odrzuceniu formularza aplikacja próbuje usunąć kopię z prywatnego cache. |
| **Klucz** | Aplikacja używa prywatnego cache Androida. Nie ma osobnego klucza szyfrującego plik zdjęcia. |
| **Ryzyko** | Przerwanie procesu może zostawić kopię w cache. W obecnym kodzie zmiana zdjęcia lub opuszczenie ekranu uruchamia też sprzątanie przez efekt React. |
| **Decyzja na MVP** | Sprawdzić usuwanie kopii po kliknięciu „Usuń zdjęcie” i ustalić, co zostaje po przerwaniu aplikacji. Trwały szkic offline obejmuje tekst i GPS. |
| **Jeśli dodamy zdjęcia offline** | Zapisywać zdjęcia jako prywatne pliki szyfrowane AES-GCM z kluczem w Android Keystore i świeżym IV przy każdym szyfrowaniu. Usuwać plik po wysłaniu lub odrzuceniu obserwacji. |

Kod mobilki — FieldObservations.tsx, wiersze 77 i 297 · [Android Keystore](https://developer.android.com/privacy-and-security/keystore)

### 1.2 Kategorie błędów

| Kategoria | Wynik i sposób sprawdzenia |
| --- | --- |
| Szyfrowanie bez integralności | Nie dotyczy obecnej kopii roboczej. Przegląd ścieżki od pickera do wysłania wykazał, że aplikacja nie szyfruje pliku na własnym poziomie. W planowanym wariancie AES-GCM wykryje zmianę szyfrogramu. |
| Powtarzane wartości jednorazowe | Do sprawdzenia przy wdrożeniu kolejki offline. Dwa zapisy tego samego zdjęcia powinny użyć różnych IV. Zmiana szyfrogramu powinna zakończyć się błędem odczytu. |

## 3. Wylogowanie terminala

### 1.1 Ochrona poświadczenia

| Pole | AgriOps Mobile |
| --- | --- |
| **Zadanie** | Usunąć poświadczenie terminala z telefonu przy wylogowaniu. |
| **Co jest teraz** | Aplikacja zamyka ekran terminala i anuluje jego żądania, po czym usuwa poświadczenie z SecureStore i wraca do parowania. |
| **Ryzyko** | Lokalna operacja usuwa wpis z telefonu. Odwołanie przypisania terminala po stronie serwera to osobna operacja. |
| **Jak sprawdzimy** | Wylogować terminal, uruchomić aplikację ponownie i sprawdzić, czy wymaga parowania. Osobno odłączyć terminal w webie i sprawdzić reakcję API. |

### 1.2 Przegląd kodu

Sprawdzono `App.tsx:74–94`, `SettingsScreen.tsx:62` i `TerminalScreen.tsx:28–57` w lokalnym drzewie źródeł. Token jest zapisywany przez Expo SecureStore i usuwany przy lokalnym wylogowaniu.

[Stan aplikacji i plan do zajęć 6](Z5-plan-do-zajec-6.md)
