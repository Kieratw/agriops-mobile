# Kryptografia w AgriOps Mobile

Materiał opisuje stan gałęzi `feat/mobile-mvp` (commit 5cf4ca8).

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

Kod mobilki — generowanie sekretu telefonu · [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)

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
| **Ryzyko** | Przerwanie procesu może zostawić kopię w cache. Przycisk „Usuń zdjęcie” w obecnym kodzie czyści stan formularza bez wywołania funkcji kasującej plik. |
| **Decyzja na MVP** | Sprzątać kopię roboczą również po kliknięciu „Usuń zdjęcie” i sprawdzić, co zostaje po przerwaniu aplikacji. Trwały szkic offline obejmuje tekst i GPS. |
| **Jeśli dodamy zdjęcia offline** | Zapisywać zdjęcia jako prywatne pliki szyfrowane AES-GCM z kluczem w Android Keystore i świeżym IV przy każdym szyfrowaniu. Usuwać plik po wysłaniu lub odrzuceniu obserwacji. |

Kod mobilki — wybór zdjęcia · Przycisk „Usuń zdjęcie” · [Android Keystore](https://developer.android.com/privacy-and-security/keystore)

### 1.2 Kategorie błędów

| Kategoria | Wynik i sposób sprawdzenia |
| --- | --- |
| Szyfrowanie bez integralności | Nie dotyczy obecnej kopii roboczej. Przegląd ścieżki od pickera do wysłania wykazał, że aplikacja nie szyfruje pliku na własnym poziomie. W planowanym wariancie AES-GCM wykryje zmianę szyfrogramu. |
| Powtarzane wartości jednorazowe | Do sprawdzenia przy wdrożeniu kolejki offline. Dwa zapisy tego samego zdjęcia powinny użyć różnych IV. Zmiana szyfrogramu powinna zakończyć się błędem odczytu. |

## 3. Odblokowanie widoku właściciela biometrią

### 1.1 Kryptografia w aplikacji

| Pole | AgriOps Mobile |
| --- | --- |
| **Zadanie** | Umożliwić właścicielowi ręczne ukrycie widoku gospodarstwa i powrót po uwierzytelnieniu na urządzeniu. |
| **Co jest teraz** | „Zablokuj biometrią” zapisuje znacznik czasu w Expo SecureStore z opcją `requireAuthentication: true`. Udany odczyt znacznika odblokowuje widok. |
| **Klucz** | SecureStore korzysta z klucza Android Keystore. Android wymaga uwierzytelnienia do użycia klucza chroniącego znacznik. |
| **Ryzyko** | Klient API i sesja sieciowa pozostają aktywne. Blokada chroni dostęp przez ekran aplikacji. Pełne zakończenie sesji wymaga wylogowania. |
| **Decyzja** | Opisywać funkcję jako blokadę widoku. Na Androidzie sprawdzić udane odblokowanie, anulowanie monitu oraz zachowanie po dodaniu odcisku palca. Po utracie dostępu użytkownik może się wylogować i zalogować hasłem. |

Kod blokowania i odblokowania · Opcje SecureStore · [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)

### 1.2 Kategorie błędów

| Kategoria | Wynik i sposób sprawdzenia |
| --- | --- |
| Klucz w kodzie | Sprawdzone w konfiguracji SecureStore. Kod zawiera nazwę wpisu i alias magazynu. Klucz szyfrujący powstaje po stronie Android Keystore. |
| Przewidywalna losowość | Znacznik czasu pełni funkcję wartości kontrolnej odczytu. IV szyfrowania generuje natywna implementacja SecureStore. |

[Stan MVP i plan do zajęć 6 — slajd 13](Z5-kryptografia-i-stan-MVP.md#2-stan-aplikacji-i-plan--slajd-13)
