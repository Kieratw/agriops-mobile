# AgriOps Mobile - model zagrożeń v1

Data: 23.10.2026. Podstawa: [karta projektu](../../README.md) i [DFD](README.md).

## 1. Zakres

Telefon właściciela i tablet w ciągniku łączą się bezpośrednio z API AgriOps.
Model obejmuje sesje, dane gospodarstwa, zdjęcia i GPS, lokalne szkice,
parowanie QR, App Links oraz mapę w WebView.

Obecnie działają szkielet logowania oparty na cookies, odczyty gospodarstw
oraz pól i mapa. Sesje terminali, parowanie, SecureStore i funkcje terenowe
są planowane. Oznaczenia elementów pochodzą ze szczegółowego DFD.

## 2. Ocena ryzyka

STRIDE: **S** - podszywanie, **T** - manipulacja, **R** - wypieranie się działania,
**I** - ujawnienie informacji, **D** - odmowa usługi, **E** - podniesienie uprawnień.

W kolumnie P/W podano prawdopodobieństwo i wpływ: N - niskie, Ś - średnie,
W - wysokie. Oceny są wstępne; uwzględniają znane ograniczenia HTTPS i WebView.

| Prawdopodobieństwo / wpływ | Niski | Średni | Wysoki |
| --- | --- | --- | --- |
| Niskie | Niskie | Niskie | Średnie |
| Średnie | Niskie | Średnie | Wysokie |
| Wysokie | Średnie | Wysokie | Wysokie |

## 3. Rejestr zagrożeń

| ID | Zagrożenie i element DFD | STRIDE | P/W | Ryzyko | Decyzja i krótkie wymaganie |
| --- | --- | --- | --- | --- | --- |
| Z01 | Kradzież lokalnego tokenu umożliwia przejęcie sesji. **D1, F12-F13**. | S, I | Ś/W | Wysokie | Zredukować: token w SecureStore, usuwany przy wylogowaniu. |
| Z02 | Zdjęcia i GPS wyciekają przez szkice lub kopie zapasowe. **D2, F14-F15**. | I | N/W | Średnie | Zredukować: chronione prywatne pliki, ograniczony backup i usuwanie po wysłaniu lub odrzuceniu. |
| Z03 | Podmiana `farmId` lub `fieldId` daje dostęp do cudzego gospodarstwa przy błędzie autoryzacji. **F3, P3**. | E, I, T | Ś/W | Wysokie | Zredukować: API sprawdza członkostwo oraz przynależność pola do gospodarstwa. |
| Z04 | Terminal wykonuje operację właściciela, np. zatwierdza własny raport. **F3, P3**. | E, T | Ś/W | Wysokie | Zredukować: serwer sprawdza rolę i przydział zadania; terminal nie zatwierdza raportów. |
| Z05 | Przechwycenie lub ponowne użycie QR pozwala uzyskać sesję terminala. **F3-F4, F11, P3**. | S, E | Ś/W | Wysokie | Zredukować: QR jednorazowy (60 s), osobny sekret i potwierdzenia obu urządzeń. |
| Z06 | Złośliwy deep link uruchamia niezamierzoną operację. **F11, P1**. | T, E | N/W | Średnie | Zredukować: zweryfikowane App Links, walidacja parametrów i potwierdzenie operacji. |
| Z07 | HTTP lub błędna walidacja certyfikatu umożliwia podsłuch i zmianę danych. **F3-F4**. | I, T | N/W | Średnie | Zredukować: HTTPS i poprawna walidacja certyfikatów; HTTP tylko lokalnie w developmencie. |
| Z08 | Podmieniony kod mapy manipuluje widokiem lub ujawnia dane WebView. **P2, F19-F20**. | T, I | N/Ś | Niskie | Zredukować: izolacja WebView, CSP i integralność skryptów; bez sesji API i prywatnych plików. |
| Z09 | Brak śladu audytowego utrudnia ustalenie wykonawcy operacji. **P3, D3**. | R | Ś/Ś | Średnie | Zredukować: audyt serwerowy zapisuje wykonawcę, obiekt, czas i wynik; terminal nie zmienia wpisów. |
| Z10 | Duże lub masowo wysyłane zdjęcia przeciążają API. **F3, P3, D4**. | D | Ś/Ś | Średnie | Zredukować: limity żądań, rozmiaru pliku i obrazu oraz przestrzeni gospodarstwa. |

Status wszystkich pozycji: **do weryfikacji**. Po testach dopiszemy przy danym
wierszu wynik, link do dowodu oraz ocenę ryzyka pozostałego po zabezpieczeniach.

## Materiały odniesienia


- [Karta projektu i plan parowania](../../README.md).
- [DFD i identyfikatory elementów](README.md).
- [Klient API](../../mobile/src/services/agriOpsApi.ts): `normalizeApiUrl` (linie 29-44) i cookies w `request` (linie 59-67).
- [Konfiguracja WebView](../../mobile/src/screens/TractorScreen.tsx): ograniczenia cookies, plików i nawigacji (linie 26-36).
- [Dokument mapy](../../mobile/src/map/mapHtml.ts): CSP, przypięta wersja Leaflet i integralność zasobów (linie 4-8).
- [Przegląd backendu i bazy](../../../agriops-docs/docs/security/backend-database-security-review.md): kontrole dostępu, sesji, uploadu i otwarte uwagi; dokument w sąsiednim repozytorium dokumentacji AgriOps.
- OWASP: [MASVS-STORAGE-1](https://mas.owasp.org/MASVS/controls/MASVS-STORAGE-1/), [MASVS-STORAGE-2](https://mas.owasp.org/MASVS/controls/MASVS-STORAGE-2/), [MASVS-AUTH-1](https://mas.owasp.org/MASVS/controls/MASVS-AUTH-1/), [MASVS-NETWORK-1](https://mas.owasp.org/MASVS/controls/MASVS-NETWORK-1/), [MASVS-PLATFORM-1](https://mas.owasp.org/MASVS/controls/MASVS-PLATFORM-1/), [MASVS-PLATFORM-2](https://mas.owasp.org/MASVS/controls/MASVS-PLATFORM-2/).

Metoda STRIDE, macierz ryzyka i powiązanie zagrożenia z wymaganiem pochodzą
z dostarczonej prezentacji „BAiSM - Zajęcia 2: Modelowanie zagrożeń i architektura”.
