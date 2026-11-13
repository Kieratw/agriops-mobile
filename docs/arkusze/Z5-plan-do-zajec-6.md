# Stan aplikacji i plan do zajęć 6

Stan z telefonu Xiaomi, Android ARM64, wersja 0.1.0 (versionCode 1). APK zaktualizowano 13.11.2026 o 11:39. SHA-256 jest zgodny z lokalnym plikiem `AgriOps-Mobile-arm64-Wylogowanie-Terminala.apk`. Zachowanie funkcji opisano na podstawie lokalnego drzewa źródeł opartego na `e901d8b` i zawierającego dodatkowe zmiany robocze. Pełny scenariusz na telefonie pozostaje do sprawdzenia.

## Stan aplikacji

| Obszar | Status | Największe ryzyko |
| --- | --- | --- |
| Funkcje (MVP) | Kod obsługuje mapę, obserwacje, próbki, parowanie QR i zlecenia terminala z produktami i dawkami. Terminal wysyła rozpoczęcie, zakończenie i notatkę do API. | Do potwierdzenia pełny obieg zlecenia na koncie testowym, łącznie z odbiorem zmian przez właściciela. |
| Build z repozytorium | APK na Xiaomi potwierdzono przez zgodność SHA-256 z lokalnym plikiem. | Build zawiera zmiany robocze. Odtworzenie APK z czystego checkoutu wymaga zapisania źródeł i konfiguracji. |
| Model zagrożeń | [Model v1](../threat-model/threat-model-v1.md) jest w repozytorium. | Trzeba zaktualizować model o raportowanie przez API i rozróżnić wylogowanie lokalne od odwołania sesji. |
| Uprawnienia | Kamera służy do zdjęć i QR, lokalizacja do mapy i obserwacji. | Do sprawdzenia odmowa i cofnięcie każdej zgody w aktualnym APK. |
| Przechowywanie danych | Token terminala oraz szkice próbek i obserwacji korzystają z SecureStore. Zdjęcie robocze jest w prywatnym cache. | Przerwany proces może zostawić kopię zdjęcia do posprzątania. |
| Kryptografia | SecureStore chroni dane lokalne. Parowanie używa losowego sekretu telefonu i HMAC po stronie serwera. | Wylogowanie terminala czyści zapis lokalny. Unieważnienie tokenu po stronie API wymaga osobnego sprawdzenia. |

**Werdykt MVP — warunkowo.** APK jest na telefonie, a kod wysyła postęp pracy do API. Do odbioru pozostaje sprawdzenie pełnej ścieżki zlecenia i odtworzenie buildu z repozytorium.

## Plan do zajęć 6

| Zadanie | Kto | Termin | Jak sprawdzimy |
| --- | --- | --- | --- |
| Zapisać źródła aktualnego buildu i odtworzyć APK z czystego checkoutu. | Wojciech Kierat | Przed zajęciami 6 | Zapisać commit i wynik buildu, zainstalować odtworzone APK. |
| Sprawdzić parowanie, raportowanie pracy i koniec sesji terminala. | Wojciech Kierat | Przed zajęciami 6 | Na koncie testowym wysłać start, koniec i notatkę. Sprawdzić widok właściciela, ponowne uruchomienie po wylogowaniu i reakcję API na odłączenie terminala. |
| Sprawdzić szkice offline i sprzątanie zdjęć. | Błażej Sztefka | Przed zajęciami 6 | Odczytać szkic po restarcie bez sieci. Sprawdzić cache po usunięciu zdjęcia i po przerwaniu aplikacji. |
| Sprawdzić odmowę zgód i uzupełnić model zagrożeń. | Błażej Sztefka | Na zajęcia 6 | Zapisać wyniki testów kamery i GPS oraz scenariuszy utraty telefonu i odłączenia terminala. |

Przydział jest propozycją na podstawie podziału ról w projekcie.
