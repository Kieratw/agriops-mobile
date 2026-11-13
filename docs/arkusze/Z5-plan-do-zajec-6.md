# Stan aplikacji i plan do zajęć 6

Materiał opisuje stan gałęzi `feat/mobile-mvp` (commit 5cf4ca8).

AgriOps Mobile · BAiSM · Zajęcia 5 · Slajd 13

## Stan aplikacji

| Obszar | Status | Największe ryzyko |
| --- | --- | --- |
| Funkcje (MVP) | Logowanie, mapa, obserwacje, próbki i tryb terminala są w kodzie. | Raport terminala pozostaje lokalny. Brakuje ścieżki wysłania i zatwierdzenia tego raportu w AgriOps. |
| Build z repozytorium | Repo zawiera konfigurację Android development build. Świeży build z czystego checkoutu do potwierdzenia. | Demo zależy od odtwarzalnego buildu, konfiguracji API i działających App Links. |
| Model zagrożeń | [Model v1](../threat-model/threat-model-v1.md) istnieje. Scenariusze nadal mają status do weryfikacji. | Brak dowodu z urządzenia dla odwołania sesji terminala i utraty telefonu. |
| Uprawnienia | Kamera, lokalizacja i powiadomienia mają opisane zastosowania. | Odmowa zgody lub cofnięcie jej w ustawieniach może przerwać ścieżkę terenową. |
| Przechowywanie danych | Dokumentacja Z4 na gałęzi `feat/mobile-mvp` i SecureStore są w repo. Android ma `allowBackup: false` w konfiguracji. | Plik zdjęcia w cache po przerwaniu procesu. Czyszczenie sesji i szkiców wymaga testu na urządzeniu. |
| Kryptografia | AES-GCM w SecureStore oraz losowe sekrety i HMAC po stronie parowania sprawdzono w źródłach. | Biometria osłania widok właściciela. Aktywna sesja sieciowa pozostaje dostępna dla klienta API w procesie aplikacji. |

**Werdykt MVP — warunkowo.** Można pokazać pracę właściciela, parowanie i lokalny zapis pracy terminala, ale pełny scenariusz wymaga przesłania raportu terminala i zatwierdzenia go przez właściciela.

## Plan do zajęć 6

| Zadanie | Kto | Termin | Jak sprawdzimy |
| --- | --- | --- | --- |
| Podłączyć wysłanie raportu terminala i zatwierdzenie w webie. | Wojciech Kierat | Przed zajęciami 6 | Przydzielone zlecenie przechodzi od startu do zatwierdzenia. Ponowienie wysyłki daje jeden raport. API odrzuca raport dla obcego zlecenia. |
| Zbudować APK z czystego checkoutu i sprawdzić parowanie. | Wojciech Kierat | Przed zajęciami 6 | Zapisać commit i wynik buildu. Na Androidzie sprawdzić App Link, porównanie numeru, wygaśnięcie QR i odłączenie terminala. |
| Sprawdzić szkice, czyszczenie i cache na Androidzie. | Błażej Sztefka | Przed zajęciami 6 | Zapisać szkic bez sieci i odczytać po restarcie. Sprawdzić wylogowanie, reinstalację oraz zdjęcie po przerwaniu formularza. Dopisać wyniki do dokumentacji Z4. |
| Przejść przypadki odmowy uprawnień i uzupełnić dowody w modelu zagrożeń. | Błażej Sztefka | Na zajęcia 6 | Udokumentować odmowę kamery, lokalizacji i powiadomień oraz wynik sprawdzenia odwołania sesji terminala. |

Przydział zadań jest propozycją na podstawie podziału ról opisanego w repozytorium. Statusy wynikają z przeglądu kodu i dokumentacji.
