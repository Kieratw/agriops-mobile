# Z2 — Modelowanie zagrożeń i architektura

| Pole | Wartość |
| --- | --- |
| Aplikacja | AgriOps Mobile |
| Zespół | Wojciech Kierat, Błażej Sztefka |
| Technologia | React Native, TypeScript, Expo, Android; API AgriOps |
| Zajęcia | 2 — Modelowanie zagrożeń i architektura |
| Data opracowania | 30.10.2026 |

## 0. Status z poprzedniego tygodnia

| Zadanie | Status | Dowód |
| --- | --- | --- |
| Repozytorium z kartą projektu | Zrobione | [README](../../README.md), [pierwszy commit](https://github.com/Kieratw/agriops-mobile/commit/c3e1b793aea26ec30c84b422268f805f1ba0be28). Repozytorium jest publiczne. |
| Szkielet aplikacji na Androidzie | Zrobione | [Kod aplikacji](../../mobile/App.tsx), [wyniki sprawdzeń](dowody/Z2-weryfikacja.md). |
| Szkic architektury i DFD | Zrobione | [DFD z granicami zaufania](../threat-model/README.md), [PNG](../threat-model/dfd-overview.png), [SVG](../threat-model/dfd-overview.svg). |
| Model zagrożeń v1 | Zrobione | [10 scenariuszy ze STRIDE, ryzykiem i decyzją](../threat-model/threat-model-v1.md). |
| Logowanie i połączenie z backendem | Częściowo zweryfikowane | Formularz i klient HTTP są zaimplementowane. API jest dostępne; udane logowanie i pobranie danych prawdziwego gospodarstwa wymagają jeszcze pokazu na urządzeniu. |

## 1. Gdzie zagrożenia występują w naszej aplikacji

| Miejsce | Dane lub funkcja | Klasyfikacja | Element DFD |
| --- | --- | --- | --- |
| Logowanie i żądania do API | E-mail, hasło podczas logowania, sesja i wybór gospodarstwa | Poufne | P1/P3, F1, F3–F6 |
| Sesja telefonu i terminala | Docelowo token oraz sekret próby parowania; obecnie sesja cookies | Poufne | D1/D3, F3–F4, F11–F13 |
| Zdjęcia, lokalizacja i szkice | Miejsce pobrania próbki, zdjęcie i raport przed wysłaniem | Szczególnie wrażliwe według karty projektu | D2/D3/D4, F9, F14–F15 |
| Mapa pól właściciela | Nazwy i granice pól pobrane z API | Wewnętrzne | P1/P2, F3–F4, F16 |
| WebView i dostawcy mapy | Oglądany obszar, kafle, biblioteka JavaScript | Publiczny podkład; oglądany obszar może ujawniać lokalizację gospodarstwa | P2, E4/E5, F17–F20 |

Analizę zaczęliśmy od trzech przepływów przecinających granice zaufania:

- **F3 — aplikacja → API:** podmiana identyfikatora gospodarstwa, pola lub zadania.
- **F11 — link → aplikacja:** niezaufane parametry i próba ponownego użycia QR.
- **F19–F20 — WebView ↔ CDN:** wykonanie kodu z zewnętrznego źródła.

## 2. Co już mamy

- Osobny klient API, który wymaga HTTPS w zwykłej konfiguracji. Lokalny HTTP dopuszcza tylko w trybie deweloperskim dla adresów lokalnych.
- Odczyt pól przez endpoint przypisany do gospodarstwa. Klient odrzuca odpowiedź zawierającą pole z innym farmId; serwer musi niezależnie sprawdzać dostęp.
- Czytelne błędy sieci, odróżnienie 401 od 403 i powrót do logowania po wygaśnięciu sesji podczas pobierania pól.
- Nagłówek Origin dla żądań POST zgodny z konfiguracją ochrony CSRF istniejącego API.
- Mapę pól z automatycznym dopasowaniem widoku i przybliżeniem wybranego pola. Geometria jest walidowana przed wyświetleniem, a nazwy trafiają do mapy jako tekst.
- WebView bez współdzielenia cookies API, dostępu do plików i lokalizacji urządzenia. Do mapy właściciela przekazujemy granice i nazwy pól, ale nie sesję ani hasło.
- Przypiętą wersję Leaflet, integralność zasobów i CSP ograniczające źródła mapy.

Przybliżenie mapy wynika z granic pól. Nie wymaga włączenia GPS urządzenia.

## 3. Czego brakuje

| Brak lub zagrożenie | Gdzie | Ryzyko | Uzasadnienie |
| --- | --- | --- | --- |
| Ograniczona sesja terminala i kontrola jego operacji | API, F3/P3 | Wysokie | Sam wybór ekranu nie nadaje ograniczonej roli. |
| Ochrona docelowych tokenów i szkiców | D1/D2 | Wysokie / średnie | SecureStore i trwałe szkice nie są jeszcze zaimplementowane; wymagania opisano w Z01–Z02. |
| Jednorazowe parowanie i zweryfikowane App Links | F11 i API | Wysokie / średnie | Przepływ jest opisany w karcie, ale nie został wdrożony. |
| Dowód poprawnego logowania i odczytu prawdziwych pól | Aplikacja i API | Do sprawdzenia funkcjonalnego | Test klienta z odpowiedzią testową nie potwierdza działania sesji z produkcyjnym kontem. |

Pełny rejestr, macierz ryzyka i decyzje dla Z01–Z10 znajdują się w [modelu zagrożeń v1](../threat-model/threat-model-v1.md). Status kontroli bezpieczeństwa pozostaje „do weryfikacji”.

## 4. Jak rozwiązuje to nasza platforma

| Mechanizm | Zastosowanie | Ograniczenia |
| --- | --- | --- |
| React Native fetch i sesja cookies | Obecne logowanie i odczyt gospodarstw/pól | Obsługa cookies na urządzeniu wymaga sprawdzenia; klient musi respektować ochronę CSRF API. |
| expo-secure-store — planowane | Przechowywanie docelowego tokenu | Ochrona lokalna nie zastępuje odwołania sesji na serwerze. |
| React Native WebView i Leaflet | Mapa oraz granice pól | Kod z CDN działa w WebView. Wymagane są izolacja sesji, integralność zasobów, walidacja danych i ograniczenie nawigacji. |
| Android App Links — planowane | Otwarcie parowania i szczegółów pola | Potrzebne powiązanie domeny z certyfikatem aplikacji; otwarcie linku nie przyznaje uprawnień. |
| Autoryzacja w API AgriOps | Sprawdzenie sesji i dostępu do gospodarstwa | Kontrola musi obejmować każde żądanie oraz relacje między identyfikatorami, również przy zmodyfikowanym kliencie. |

## 5. Plan i odpowiedzialność

| Zadanie | Osoba | Jak potwierdzimy działanie | Obszar MASVS |
| --- | --- | --- | --- |
| DFD i model v1 z minimum 10 zagrożeniami | Błażej Sztefka; przegląd wspólnie | Pliki w docs/threat-model/, komplet kategorii STRIDE, ryzyka i decyzje powiązane z elementami DFD | AUTH, NETWORK, STORAGE, PLATFORM |
| Połączenie aplikacji z API i mapa pól | Wojciech Kierat | Testy klienta i geometrii; logowanie prawdziwym kontem oraz pokaz pola na urządzeniu | AUTH, NETWORK, PLATFORM |
| Przegląd danych lokalnych i uprawnień przed kolejnym tematem | Błażej Sztefka | Lista danych i porównanie konfiguracji projektu z manifestem APK | STORAGE, PRIVACY |
| Zebranie wyników i omówienie z prowadzącym | Wspólnie | Ten arkusz, linki do wyników i zanotowane uwagi | CODE oraz dokumentacja weryfikacji |

## 6. Pytania do prowadzącego

- Czy pliki SVG i Mermaid razem z PNG są wystarczającym formatem źródłowym DFD?
- Czy pokaz na emulatorze wystarczy na ten etap, jeżeli sprzęt ESP32 będzie dołączony później?

## Notatki prowadzącego

Do uzupełnienia po omówieniu. Ocena aktywności nie została wpisana.
