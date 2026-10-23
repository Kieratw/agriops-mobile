# AgriOps Mobile - model zagrożeń v1

Data: 23.10.2026. Status: model roboczy do realizacji i weryfikacji w MVP.
Podstawa: [karta projektu](../../README.md) i [DFD](README.md).
Przegląd kodu mobilnego odnosi się do rewizji `2b4491e`.

## 1. Zakres

Model obejmuje telefon właściciela i tablet w ciągniku, bezpośrednią komunikację
HTTPS z API AgriOps, bazę i prywatne pliki, magazyn lokalny, wejścia z Androida,
parowanie QR, App Links oraz mapę w WebView. Konkretny VPS i wybór danych
testowych lub produkcyjnych wymagają ustalenia; zmiana tych założeń wymaga
ponownego oszacowania wpływu.

Chronione zasoby to sesje i uprawnienia, przypisania terminali, dane gospodarstw
i zadań, integralność raportów, zdjęcia, dokładna lokalizacja i dostępność API.
Właściciel i terminal mają osobne sesje i różny zakres dostępu. Wybór ekranu
w aplikacji nie nadaje uprawnień.

Rozpatrujemy osobę wysyłającą zmodyfikowane żądania lub linki, użytkownika
z ograniczoną sesją terminala, osobę posiadającą zgubione urządzenie lub kopię
danych oraz ingerencję w niezaufaną sieć lub treści zewnętrzne.

Obecny szkielet zawiera logowanie oparte na cookies, pobieranie gospodarstw
i pól oraz mapę. Sesje terminali, mobilny kontrakt tokenów, parowanie, SecureStore,
trwałe szkice i funkcje terenowe są planowane. Oznaczenia `P`, `D`, `F` i `G`
pochodzą ze szczegółowych diagramów w [DFD](README.md).
ESP32, ciągłe śledzenie maszyn i mapy offline pozostają poza MVP.

## 2. Metoda i ryzyko

| STRIDE | Kategoria | Chroniona właściwość |
| --- | --- | --- |
| S | Podszywanie się | Uwierzytelnienie |
| T | Manipulacja danymi | Integralność |
| R | Wypieranie się działania | Rozliczalność działań |
| I | Ujawnienie informacji | Poufność |
| D | Odmowa usługi | Dostępność |
| E | Podniesienie uprawnień | Autoryzacja |

`P` oznacza prawdopodobieństwo, `W` wpływ, a `R0` wstępne ryzyko projektowe.
Ocena jest jakościowa i służy priorytetyzacji scenariuszy w MVP. Uwzględnia
znane ograniczenia, w szczególności wymóg HTTPS i izolację WebView.

- P niskie: potrzebne są dodatkowe warunki, np. dostęp do kopii urządzenia
  lub obejście istniejącej kontroli.
- P średnie: scenariusz jest osiągalny przez normalne wejście aplikacji lub API
  przy błędnej implementacji planowanej funkcji.
- P wysokie: łatwo dostępna, powtarzalna droga ataku przy słabych ograniczeniach.
- W niski: ograniczony, łatwy do odwrócenia skutek lokalny.
- W średni: zakłócenie działania lub rozliczania pracy w ograniczonym zakresie.
- W wysoki: przejęcie sesji, rozszerzenie uprawnień albo ujawnienie lub
  modyfikacja chronionych danych gospodarstwa.

Macierz odpowiada materiałowi z zajęć:

| Prawdopodobieństwo / wpływ | Niski | Średni | Wysoki |
| --- | --- | --- | --- |
| Niskie | Niskie | Niskie | Średnie |
| Średnie | Niskie | Średnie | Wysokie |
| Wysokie | Średnie | Wysokie | Wysokie |

Decyzja **zredukować** oznacza wdrożenie lub zachowanie wskazanych kontroli
i dostarczenie dowodu ich działania. Pozostałe dopuszczalne decyzje to
wyeliminować, przenieść i zaakceptować. Akceptacja wymaga uzasadnienia.
`R1` to ryzyko pozostałe po zweryfikowaniu zabezpieczeń; uzupełniamy je po
testach wraz z uzasadnieniem. Sama implementacja nie nadaje oceny R1.

## 3. Rejestr zagrożeń

| ID | Scenariusz i element DFD | STRIDE | P | W | R0 | Decyzja / wymaganie |
| --- | --- | --- | --- | --- | --- | --- |
| Z01 | Skopiowanie tokenu z niechronionego pliku lub kopii danych urządzenia pozwala podszyć się pod właściciela albo terminal. **D1, F12-F13**. | S, I | Średnie | Wysoki | Wysokie | Zredukować / REQ-Z01 |
| Z02 | Zdjęcie i dokładna lokalizacja ze szkicu trafiają do nieuprawnionej osoby przez kopię zapasową lub dostęp kolejnego użytkownika urządzenia. **D2, F14-F15**. | I | Niskie | Wysoki | Średnie | Zredukować / REQ-Z02 |
| Z03 | Zmiana `farmId` lub `fieldId` w żądaniu umożliwia odczyt lub modyfikację danych innego gospodarstwa przy nieskutecznej kontroli dostępu. **F3, P3**. | E, I, T | Średnie | Wysoki | Wysokie | Zredukować / REQ-Z03 |
| Z04 | Użytkownik sesji terminala wykonuje operację właściciela, np. zatwierdza własny raport lub zarządza dostępem. **F3, P3**. | E, T | Średnie | Wysoki | Wysokie | Zredukować / REQ-Z04 |
| Z05 | Przechwycony lub ponownie użyty QR pozwala nieuprawnionej osobie uzyskać sesję albo przypisać obcy terminal. **F3-F4, F11, P3**. | S, E | Średnie | Wysoki | Wysokie | Zredukować / REQ-Z05 |
| Z06 | Złośliwy deep link wywołuje niezamierzoną akcję, np. zatwierdzenie parowania bez świadomego potwierdzenia. **F11, P1**. | T, E | Niskie | Wysoki | Średnie | Zredukować / REQ-Z06 |
| Z07 | Osoba kontrolująca sieć odczytuje lub zmienia komunikację z API, jeżeli wydanie aplikacji dopuści HTTP albo nieprawidłowy certyfikat. **F3-F4**. | I, T | Niskie | Wysoki | Średnie | Zredukować / REQ-Z07 |
| Z08 | Podmieniony kod mapy manipuluje widokiem lub ujawnia dane dostępne w kontekście WebView. **P2, F19-F20**. | T, I | Niskie | Średni | Niskie | Zredukować / REQ-Z08 |
| Z09 | Brak wiarygodnego śladu audytowego utrudnia ustalenie, kto wysłał raport, zatwierdził pracę lub sparował terminal. **P3, D3**. | R | Średnie | Średni | Średnie | Zredukować / REQ-Z09 |
| Z10 | Zalogowany klient przeciąża API dużymi, wadliwymi lub wielokrotnie przesyłanymi zdjęciami, ograniczając dostęp innym użytkownikom. **F3, P3, D4**. | D | Średnie | Średni | Średnie | Zredukować / REQ-Z10 |
| Z11 | Posiadacz zgubionego tabletu lub skopiowanego tokenu korzysta z sesji terminala po odwołaniu jej przez właściciela. **F3, P3, D3**. | S, E | Średnie | Wysoki | Wysokie | Zredukować / REQ-Z11 |
| Z12 | Token, sekret parowania lub dokładna lokalizacja trafiają do logów aplikacji albo API i zostają odczytane przez nieuprawnioną osobę. **P1, P3**. | I | Niskie | Wysoki | Średnie | Zredukować / REQ-Z12 |

## 4. Wymagania i kryteria weryfikacji

Identyfikatory `REQ-Z…` są wymaganiami projektu. MASVS wskazuje obszar
bezpieczeństwa mobilnego; szczegółowe reguły API określa treść wymagania
i kryterium sprawdzane po stronie serwera.

| Wymaganie | Zabezpieczenie | Kryterium weryfikacji | Odniesienie |
| --- | --- | --- | --- |
| REQ-Z01 | Token przechowywać przez SecureStore. Wykluczyć jawny zapis tokenów w zwykłych plikach, eksportach i niechronionych kopiach. Hasła nie zapisywać lokalnie. | Inspekcja danych aplikacji i obsługiwanej kopii/odtworzenia nie ujawnia jawnego tokenu ani hasła w zwykłych plikach. Sprawdzić telefon i terminal. | MASVS-STORAGE-1/2 |
| REQ-Z02 | Powiązać szkic z kontem, chronić zapis i kopie zapasowe, blokować dostęp innego konta. Usuwać dane po wysłaniu lub świadomym odrzuceniu. | Sprawdzić restart, wylogowanie, zmianę konta, backup oraz usunięcie po wysłaniu/odrzuceniu. Inne konto nie odczytuje szkicu; niewysłana praca nie ginie bez wiedzy użytkownika. | MASVS-STORAGE-1/2 |
| REQ-Z03 | API sprawdza członkostwo i przynależność obiektów do gospodarstwa przy odczycie i zapisie. Stosować kontrole także do nowych funkcji mobilnych. | Konto A nie odczytuje i nie zmienia pola gospodarstwa B po podmianie identyfikatorów. Odpowiedź nie ujawnia chronionych danych, a stan B pozostaje poprawny. | Kontrola dostępu API |
| REQ-Z04 | Zakres operacji wynika z sesji i przypisania terminala po stronie serwera. Oddzielić wykonanie pracy od zatwierdzania i zarządzania dostępem. | Terminal nie zatwierdza własnego raportu, nie zarządza dostępem i nie pobiera nieprzydzielonego zadania, również przy bezpośrednim żądaniu z pominięciem UI. | MASVS-AUTH-1; role API |
| REQ-Z05 | Kod ma co najmniej 128 bitów losowości i ważność 60 sekund. Osobny sekret terminala pozostaje poza QR. Wymagać potwierdzeń na obu urządzeniach, niezmiennego zatwierdzonego przypisania i atomowego odbioru sesji. | Odrzucić kod wygasły, ponowne użycie i odbiór bez sekretu lub potwierdzenia. Dwa równoczesne odbiory nie tworzą dwóch sesji. Samo zdjęcie QR nie wystarcza. | MASVS-AUTH-1; parowanie API |
| REQ-Z06 | Zweryfikowane Android App Links, ustalona domena i ścieżki, walidacja parametrów. Link prowadzi do podglądu/potwierdzenia; nie wykonuje sam mutacji i nie zmienia adresu API. | Obca domena, niedozwolona ścieżka i zmienione parametry nie wywołują operacji. Poprawny link wymaga właściwej sesji i potwierdzenia. Sprawdzić powiązanie domeny z podpisem wydania. | MASVS-PLATFORM-1 |
| REQ-Z07 | W wydaniu wymagać HTTPS i poprawnej walidacji certyfikatu. Wyjątek HTTP ograniczyć do lokalnego developmentu. | Wydanie odrzuca HTTP oraz certyfikat niezaufany, wygasły i niedopasowany do hosta. Poprawny HTTPS działa; błąd nie powoduje przejścia na HTTP. | MASVS-NETWORK-1 |
| REQ-Z08 | Zachować ograniczenia nawigacji, CSP, kontrolę integralności JS/CSS i izolację WebView od sesji oraz prywatnych plików. Nie przekazywać tokenów i sekretu parowania. | Zmieniony zasób z CDN nie wykonuje się przy błędzie integralności. Niedozwolona nawigacja jest blokowana. Mapa nie uzyskuje dostępu do sesji i prywatnych plików. | MASVS-PLATFORM-2 |
| REQ-Z09 | Rejestrować po stronie serwera wykonawcę (konto/terminal), gospodarstwo, obiekt, czas i wynik istotnej operacji. Ograniczyć dostęp i modyfikację audytu. | Raport, zatwierdzenie pracy, parowanie i odwołanie sesji mają ślad zgodny ze stanem operacji. Terminal nie może zmienić wykonawcy ani usunąć wpisu. | Rozliczalność działań API |
| REQ-Z10 | Limity rozmiaru pliku i obrazu po dekodowaniu, żądań, współbieżności kosztownych operacji i przestrzeni gospodarstwa obejmują endpointy mobilne. | Nadmiarowe lub wadliwe dane są kontrolowanie odrzucane. Seria żądań uruchamia limit; nie powstają częściowe pliki ani przekroczenie przydzielonej przestrzeni. Sprawdzić wspólny NAT. | Dostępność i walidacja API |
| REQ-Z11 | API sprawdza aktywność sesji przy każdym żądaniu. Wylogowanie usuwa lokalne dane uwierzytelniające; odłączenie terminala działa niezależnie od jego łączności. | Odwołana sesja nie pozwala na odczyt ani zapis. Sprawdzić także tablet, który był offline przy odwołaniu, a następnie odzyskał łączność. | MASVS-AUTH-1; sesje API |
| REQ-Z12 | Nie logować haseł, tokenów, kodów/sekretów parowania, surowych zdjęć i dokładnej lokalizacji. Stosować ograniczony zestaw metadanych i redakcję danych. | Logowanie, błędne żądanie, parowanie i wysłanie zdjęcia w wydaniu aplikacji oraz API nie ujawniają testowych wartości sekretów i lokalizacji w logach. | MASVS-STORAGE-2; diagnostyka API |

## 5. Stan realizacji i dowody

Stan implementacji i wynik testu są osobnymi polami. Materiał z przeglądu kodu
pomaga zaplanować weryfikację. Link do dowodu dodajemy po wykonaniu testu;
dowód wskazuje datę, wersję aplikacji/API, warunki i wynik. Używamy danych
testowych z usuniętymi sekretami i danymi osobowymi.

| ID | Stan zabezpieczenia w modelu v1 | Weryfikacja | Dowód testu | R1 |
| --- | --- | --- | --- | --- |
| Z01 | SecureStore i mobilny kontrakt tokenów planowane. | Do wykonania | Do uzupełnienia | Do oceny |
| Z02 | Trwałe szkice i ochrona lokalnych danych terenowych planowane. | Do wykonania | Do uzupełnienia | Do oceny |
| Z03 | Kontrole dostępu opisane w przeglądzie backendu; pokrycie nowych operacji mobilnych do sprawdzenia. | Do wykonania | Do uzupełnienia | Do oceny |
| Z04 | Ograniczona rola i zakres terminala planowane. | Do wykonania | Do uzupełnienia | Do oceny |
| Z05 | Protokół opisany w karcie projektu; implementacja planowana. | Do wykonania | Do uzupełnienia | Do oceny |
| Z06 | App Links i powiązanie domeny z podpisem wydania planowane. | Do wykonania | Do uzupełnienia | Do oceny |
| Z07 | Wymóg HTTPS istnieje w kliencie; zachowanie wydania i konfiguracji Androida do sprawdzenia. | Do wykonania | Do uzupełnienia | Do oceny |
| Z08 | Ograniczenia WebView, CSP i SRI istnieją w kodzie. | Do wykonania | Do uzupełnienia | Do oceny |
| Z09 | Pokrycie wskazanych operacji audytem do ustalenia. | Do wykonania | Do uzupełnienia | Do oceny |
| Z10 | Kontrole uploadu opisane w przeglądzie backendu; funkcje mobilne i limitowanie do sprawdzenia. | Do wykonania | Do uzupełnienia | Do oceny |
| Z11 | Kontrola sesji użytkownika opisana w przeglądzie backendu; sesje terminali planowane. | Do wykonania | Do uzupełnienia | Do oceny |
| Z12 | Zakres logowania i redakcja danych dla scenariuszy mobilnych do sprawdzenia. | Do wykonania | Do uzupełnienia | Do oceny |

Po teście zapisujemy PASS/FAIL i link do istniejącego dowodu. Przy FAIL wpis
pozostaje otwarty. Po poprawce zachowujemy wynik i informację o ponownej
weryfikacji. Zmiana roli, magazynu, sesji, dostawcy mapy lub sposobu wdrożenia
wymaga przeglądu odpowiednich scenariuszy i ocen.

## 6. Materiały odniesienia

- [Karta projektu i plan parowania](../../README.md).
- [DFD i identyfikatory elementów](README.md).
- [Klient API](../../mobile/src/services/agriOpsApi.ts): `normalizeApiUrl` (linie 29-44) i cookies w `request` (linie 59-67).
- [Konfiguracja WebView](../../mobile/src/screens/TractorScreen.tsx): ograniczenia cookies, plików i nawigacji (linie 26-36).
- [Dokument mapy](../../mobile/src/map/mapHtml.ts): CSP, przypięta wersja Leaflet i integralność zasobów (linie 4-8).
- [Przegląd backendu i bazy](../../../agriops-docs/docs/security/backend-database-security-review.md): kontrole dostępu, sesji, uploadu i otwarte uwagi; dokument w sąsiednim repozytorium dokumentacji AgriOps.
- OWASP: [MASVS-STORAGE-1](https://mas.owasp.org/MASVS/controls/MASVS-STORAGE-1/), [MASVS-STORAGE-2](https://mas.owasp.org/MASVS/controls/MASVS-STORAGE-2/), [MASVS-AUTH-1](https://mas.owasp.org/MASVS/controls/MASVS-AUTH-1/), [MASVS-NETWORK-1](https://mas.owasp.org/MASVS/controls/MASVS-NETWORK-1/), [MASVS-PLATFORM-1](https://mas.owasp.org/MASVS/controls/MASVS-PLATFORM-1/), [MASVS-PLATFORM-2](https://mas.owasp.org/MASVS/controls/MASVS-PLATFORM-2/).

Metoda STRIDE, macierz ryzyka i powiązanie zagrożenia z wymaganiem pochodzą
z dostarczonej prezentacji „BAiSM - Zajęcia 2: Modelowanie zagrożeń i architektura”.
