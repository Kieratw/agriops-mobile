# Sprawdzenie aplikacji

Sprawdzone na emulatorze Medium_Phone_API_37.0 (x86_64):

- TypeScript i 9 testów klienta API zakończone poprawnie.
- Build Androida i instalacja APK zakończone poprawnie.
- Działają ekran wyboru trybu, formularz logowania, powrót i mapa Geoportalu.
- Publiczny endpoint https://api.agriops.pl/health odpowiedział HTTP 200.

Logowanie prawdziwym kontem oraz odczyt prywatnych gospodarstw i pól wymagają jeszcze sprawdzenia na urządzeniu.

## Sprawdzenie przed pierwszym commitem — 23.10.2026

- Ponowny build Androida x86_64 oraz eksport JavaScript/Hermes zakończone poprawnie.
- Wersje bibliotek zgodne z Expo według expo install --check.
- Publiczny health zwraca HTTP 200, a lista gospodarstw bez sesji HTTP 401.
- Po odpowiedzi 401 przy pobieraniu pól aplikacja usuwa stan gospodarstwa i wraca do formularza logowania. Błąd sieci ma komunikat po polsku.
- Testy obejmują także logowanie, pustą odpowiedź 204 przy wylogowaniu oraz rozróżnienie statusów 401 i 403.
- W plikach przygotowanych do commita sprawdzono wzorce sekretów i wykluczenie konfiguracji lokalnej, zależności, APK i logów. Nie jest to pełny audyt bezpieczeństwa aplikacji.

## Problemy przy uruchamianiu

Pierwsze próby kompilacji wymagały poprawienia obsługi Path/PATH na Windowsie i skrócenia ścieżek CMake. Plugin projektu ustawia CMAKE_OBJECT_PATH_MAX=250. Pobieranie bibliotek wymaga dostępu do dl.google.com.

Błąd instalacji „Failure calling service package: Broken pipe” ustąpił po pełnym uruchomieniu emulatora bez wczytywania zapisanego stanu (Cold Boot). Dane emulatora nie były kasowane.

## Zależności

Ponowny npm audit z 23.10.2026 zgłosił 15 wpisów high związanych z dwoma zgłoszeniami w zależnościach przechodnich narzędzi: braces 3.0.3 (GHSA-vfj7-8cjw-p6xm) oraz node-forge 1.4.0 (GHSA-86w9-cpqp-85rv). Rejestr npm podaje te wersje jako najnowsze; zgodne poprawki nie są jeszcze dostępne. Wpływ na działającą aplikację nie został potwierdzony. Nie wykonano npm audit fix --force, który proponuje niezgodne cofnięcie Expo i React Native.
