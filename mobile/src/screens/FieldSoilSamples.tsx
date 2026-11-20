import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Button, ErrorMessage, Input, TextButton } from '../components/ui';
import { FieldsMap } from '../map/FieldsMap';
import { isPointInsideField } from '../map/geometry';
import type { MapMarker } from '../map/mapHtml';
import {
  AgriOpsApi,
  ApiError,
  type Field,
  type SaveSoilSamplePointInput,
  type SoilSamplePointItem,
  type SoilTestDetail,
} from '../services/agriOpsApi';
import { cancelDraftReminder, requestReminderPermission, scheduleDraftReminder } from '../services/draftReminder';
import {
  deleteSoilSampleDraft,
  loadSoilSampleDraft,
  saveSoilSampleDraft,
  type LocationSource,
  type SoilSampleDraftPoint,
} from '../services/secureDrafts';
import { colors, layout } from '../theme';

type Props = {
  api: AgriOpsApi;
  field: Field;
  onBack: () => void;
};

const message = (error: unknown) => error instanceof Error ? error.message : 'Spróbuj ponownie.';
const todayIso = () => new Date().toISOString().slice(0, 10);

function parseOptionalNumber(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : NaN;
}

export function FieldSoilSamples({ api, field, onBack }: Props) {
  const [tests, setTests] = useState<SoilTestDetail[] | null>(null);
  const [listError, setListError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const [sampleDate, setSampleDate] = useState(todayIso);
  const [labName, setLabName] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'COMPLETED'>('DRAFT');
  const [testNotes, setTestNotes] = useState('');
  const [draftPoints, setDraftPoints] = useState<SoilSampleDraftPoint[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [notificationInfo, setNotificationInfo] = useState('');
  const [notificationBlocked, setNotificationBlocked] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const [sampleLabel, setSampleLabel] = useState('P-1');
  const [selectedPoint, setSelectedPoint] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    source: LocationSource;
  } | null>(null);
  const [depthFrom, setDepthFrom] = useState('0');
  const [depthTo, setDepthTo] = useState('20');
  const [soilType, setSoilType] = useState('');
  const [ph, setPh] = useState('');
  const [p2O5, setP2O5] = useState('');
  const [k2O, setK2O] = useState('');
  const [mg, setMg] = useState('');
  const [pointNotes, setPointNotes] = useState('');
  const [targetSoilTestId, setTargetSoilTestId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [error, setError] = useState('');
  const [savedBanner, setSavedBanner] = useState('');
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    async function restoreDraft() {
      try {
        const draft = await loadSoilSampleDraft(SecureStore, field.farmId, field.fieldId);
        if (!active || !draft) return;
        setSampleDate(draft.sampleDate || todayIso());
        setLabName(draft.labName);
        setStatus(draft.status);
        setTestNotes(draft.notes);
        setDraftPoints(draft.points);
        setReminderEnabled(draft.reminderEnabled);
        setSampleLabel(`P-${draft.points.length + 1}`);
      } catch {
        // Ignoruj błąd odczytu szkicu.
      } finally {
        if (active) setDraftLoaded(true);
      }
    }
    void restoreDraft();
    return () => { active = false; };
  }, [field.farmId, field.fieldId]);

  useEffect(() => {
    if (!draftLoaded) return;
    if (draftPoints.length === 0 && !labName.trim() && !testNotes.trim()) return;
    void saveSoilSampleDraft(SecureStore, {
      farmId: field.farmId,
      fieldId: field.fieldId,
      sampleDate,
      labName,
      status,
      notes: testNotes,
      reminderEnabled,
      updatedAtUtc: new Date().toISOString(),
      points: draftPoints,
    }).catch(() => {});
  }, [draftLoaded, draftPoints, field.farmId, field.fieldId, labName, reminderEnabled, sampleDate, status, testNotes]);

  useEffect(() => {
    if (!draftLoaded) return;
    if (reminderEnabled && draftPoints.length > 0) {
      void scheduleDraftReminder(field.farmId, field.fieldId).catch(() => {});
    } else {
      void cancelDraftReminder(field.farmId, field.fieldId);
    }
  }, [draftLoaded, draftPoints.length, field.farmId, field.fieldId, reminderEnabled]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const summaries = await api.soilTests(field.farmId, field.fieldId);
        const detailed = await Promise.all(
          summaries.slice(0, 10).map(item => api.soilTest(field.farmId, item.soilTestId)),
        );
        if (active) setTests(detailed);
      } catch (e) {
        if (active) setListError(message(e));
      }
    }
    void load();
    return () => { active = false; };
  }, [api, field.farmId, field.fieldId, attempt]);

  function refresh() {
    setListError('');
    setAttempt(value => value + 1);
  }

  function handleMapSelect(point: { latitude: number; longitude: number }) {
    setError('');
    setSavedBanner('');
    if (!field.geometry) {
      setError('To pole nie ma zapisanych granic na mapie, więc nie można zweryfikować punktu.');
      return;
    }
    if (!isPointInsideField(field.geometry, point.latitude, point.longitude, 5)) {
      setError('Wskazany punkt leży poza granicą pola. Dotknij miejsca wewnątrz granic pola.');
      return;
    }
    setSelectedPoint({
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: null,
      source: 'manual',
    });
  }

  async function locateByGps() {
    setBusy(true);
    setError('');
    setSavedBanner('');
    setLocationBlocked(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationBlocked(!permission.canAskAgain);
        setError(
          permission.canAskAgain
            ? 'Brak zgody na lokalizację GPS. Możesz zaznaczyć miejsce pobrania próbki ręcznie na mapie pola.'
            : 'Dostęp do lokalizacji został zablokowany na stałe. Otwórz ustawienia systemowe albo wskaż punkt ręcznie na mapie.',
        );
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (field.geometry && !isPointInsideField(field.geometry, coords.latitude, coords.longitude, 5)) {
        setError('Twoja aktualna pozycja GPS znajduje się poza granicami tego pola. Wskaż punkt pobrania próbki na mapie pola.');
        return;
      }
      setSelectedPoint({
        latitude: Number(coords.latitude.toFixed(6)),
        longitude: Number(coords.longitude.toFixed(6)),
        accuracy: coords.accuracy != null ? Math.round(coords.accuracy * 10) / 10 : null,
        source: 'gps',
      });
    } catch {
      setError('Nie udało się odczytać pozycji GPS. Możesz wskazać punkt ręcznie na mapie pola.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleReminder() {
    setNotificationInfo('');
    setNotificationBlocked(false);
    if (reminderEnabled) {
      setReminderEnabled(false);
      setNotificationInfo('Przypomnienie o niedokończonym szkicu próbki zostało wyłączone.');
      return;
    }
    try {
      const result = await requestReminderPermission();
      if (result !== 'granted') {
        setNotificationBlocked(result === 'blocked');
        setNotificationInfo(
          result === 'blocked'
            ? 'Powiadomienia są zablokowane w ustawieniach Androida. Szkic próbki nadal zapisuje się bezpiecznie lokalnie.'
            : 'Odmówiono zgody na powiadomienia. Aplikacja działa dalej, a szkic próbki jest chroniony lokalnie.',
        );
        return;
      }
    } catch {
      setNotificationInfo('Nie udało się sprawdzić uprawnienia powiadomień. Szkic pozostaje zapisany lokalnie.');
      return;
    }
    setReminderEnabled(true);
    setNotificationInfo('Przypomnienie zostanie wyświetlone po godzinie, jeśli szkic pozostanie niewysłany.');
  }

  function validateCurrentPoint(): SoilSampleDraftPoint | null {
    if (!sampleLabel.trim()) {
      setError('Podaj oznaczenie próbki (np. P-1).');
      return null;
    }
    if (!selectedPoint) {
      setError('Wskaż miejsce pobrania próbki na mapie pola lub pobierz pozycję GPS.');
      return null;
    }
    if (field.geometry && !isPointInsideField(field.geometry, selectedPoint.latitude, selectedPoint.longitude, 5)) {
      setError('Punkt próbki znajduje się poza granicą wybranego pola.');
      return null;
    }
    const fromVal = parseOptionalNumber(depthFrom);
    const toVal = parseOptionalNumber(depthTo);
    if (Number.isNaN(fromVal) || Number.isNaN(toVal) || (fromVal !== null && fromVal < 0) || (toVal !== null && toVal > 300)) {
      setError('Głębokość pobrania musi mieścić się w przedziale 0–300 cm.');
      return null;
    }
    if (fromVal !== null && toVal !== null && toVal < fromVal) {
      setError('Głębokość końcowa nie może być mniejsza niż początkowa.');
      return null;
    }
    const phVal = parseOptionalNumber(ph);
    if (Number.isNaN(phVal) || (phVal !== null && (phVal < 0 || phVal > 14))) {
      setError('Odczyn pH musi być liczbą z zakresu 0–14.');
      return null;
    }
    for (const [label, raw] of [['P2O5', p2O5], ['K2O', k2O], ['Mg', mg]] as const) {
      const parsed = parseOptionalNumber(raw);
      if (Number.isNaN(parsed) || (parsed !== null && parsed < 0)) {
        setError(`Wartość ${label} musi być nieujemną liczbą.`);
        return null;
      }
    }
    return {
      sampleLabel: sampleLabel.trim(),
      latitude: selectedPoint.latitude,
      longitude: selectedPoint.longitude,
      gpsAccuracyMeters: selectedPoint.accuracy,
      locationSource: selectedPoint.source,
      depthCmFrom: depthFrom.trim(),
      depthCmTo: depthTo.trim(),
      soilType: soilType.trim(),
      ph: ph.trim(),
      p2O5: p2O5.trim(),
      k2O: k2O.trim(),
      mg: mg.trim(),
      notes: pointNotes.trim(),
    };
  }

  function addPointToDraft() {
    setError('');
    setSavedBanner('');
    const valid = validateCurrentPoint();
    if (!valid) return;
    const next = [...draftPoints, valid];
    setDraftPoints(next);
    setSampleLabel(`P-${next.length + 1}`);
    setSelectedPoint(null);
    setPointNotes('');
    setSavedBanner(`Dodano punkt ${valid.sampleLabel} do lokalnego szkicu w chronionym magazynie.`);
  }

  function removeDraftPoint(index: number) {
    setDraftPoints(current => current.filter((_, idx) => idx !== index));
  }

  async function discardDraft() {
    setDraftPoints([]);
    setLabName('');
    setTestNotes('');
    setSelectedPoint(null);
    setReminderEnabled(false);
    setSavedBanner('Lokalny szkic próbki został usunięty.');
    await deleteSoilSampleDraft(SecureStore, field.farmId, field.fieldId).catch(() => {});
  }

  function toApiPoint(point: SoilSampleDraftPoint): SaveSoilSamplePointInput {
    const sourceNote = point.locationSource === 'manual' ? '[Punkt wskazany ręcznie na mapie]' : '[Punkt pobrany z GPS]';
    const combinedNotes = [point.notes, sourceNote].filter(Boolean).join(' ');
    return {
      fieldId: field.fieldId,
      sampleLabel: point.sampleLabel,
      latitude: point.latitude,
      longitude: point.longitude,
      gpsAccuracyMeters: point.gpsAccuracyMeters,
      depthCmFrom: parseOptionalNumber(point.depthCmFrom),
      depthCmTo: parseOptionalNumber(point.depthCmTo),
      soilType: point.soilType || null,
      notes: combinedNotes || null,
      measuredAt: new Date().toISOString(),
      ph: parseOptionalNumber(point.ph),
      p2O5MgPer100g: parseOptionalNumber(point.p2O5),
      k2OMgPer100g: parseOptionalNumber(point.k2O),
      mgMgPer100g: parseOptionalNumber(point.mg),
    };
  }

  async function submitSoilSamples() {
    if (busy || saving.current) return;
    setError('');
    setSavedBanner('');

    let pointsToSend = [...draftPoints];
    if (pointsToSend.length === 0) {
      const current = validateCurrentPoint();
      if (!current) return;
      pointsToSend = [current];
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sampleDate.trim())) {
      setError('Podaj datę pobrania w formacie RRRR-MM-DD.');
      return;
    }

    saving.current = true;
    setBusy(true);
    try {
      if (targetSoilTestId) {
        // Punkty dopisujemy po kolei; wysłane są usuwane ze szkicu, więc ponowienie nie dubluje wpisów.
        let remaining = [...pointsToSend];
        try {
          for (const point of pointsToSend) {
            await api.addSoilSamplePoint(field.farmId, targetSoilTestId, toApiPoint(point));
            remaining = remaining.slice(1);
          }
        } finally {
          if (remaining.length !== pointsToSend.length && draftPoints.length > 0) setDraftPoints(remaining);
        }
      } else {
        await api.createSoilTest(field.farmId, {
          sampleDate: sampleDate.trim(),
          labName: labName.trim() || null,
          status,
          notes: testNotes.trim() || null,
          samplePoints: pointsToSend.map(toApiPoint),
        });
      }
      await deleteSoilSampleDraft(SecureStore, field.farmId, field.fieldId).catch(() => {});
      setDraftPoints([]);
      setSelectedPoint(null);
      setPointNotes('');
      setTestNotes('');
      setTargetSoilTestId(null);
      setSampleLabel('P-1');
      setSavedBanner('Próba glebowa i punkty pobrania zostały zapisane w AgriOps, a lokalny szkic wyczyszczony.');
      refresh();
    } catch (e) {
      const rejected = e instanceof ApiError && e.status < 500;
      setError(
        rejected
          ? message(e)
          : `${message(e)} Szkic punktów pozostaje bezpiecznie zapisany lokalnie — możesz ponowić wysyłkę po odzyskaniu połączenia.`,
      );
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }

  const savedPoints: SoilSamplePointItem[] = (tests ?? []).flatMap(test =>
    test.samplePoints.filter(pt => pt.fieldId.toLowerCase() === field.fieldId.toLowerCase()),
  );
  const mapMarkers: MapMarker[] = [
    ...savedPoints.map(pt => ({
      id: pt.soilSamplePointId,
      label: `${pt.sampleLabel}${pt.ph != null ? ` · pH ${pt.ph}` : ''}`,
      latitude: pt.latitude,
      longitude: pt.longitude,
    })),
    ...draftPoints.map((pt, idx) => ({
      id: `draft-${idx}`,
      label: `${pt.sampleLabel} (szkic)`,
      latitude: pt.latitude,
      longitude: pt.longitude,
    })),
  ];

  return (
    <>
      <TextButton title="Wróć do pól" onPress={onBack} />
      <Text style={layout.title}>{field.nazwa}</Text>
      <Text style={layout.subtitle}>Próbki gleby i punkty pobrania</Text>

      <FieldsMap
        fields={[field]}
        focus={{ fieldId: field.fieldId }}
        markers={mapMarkers}
        selectedPoint={selectedPoint ? { latitude: selectedPoint.latitude, longitude: selectedPoint.longitude } : null}
        onSelectPoint={handleMapSelect}
      />

      <Text style={styles.sectionTitle}>1. Miejsce i dane punktu próbki</Text>
      <Text style={layout.detail}>
        Dotknij miejsca wewnątrz granic pola na powyższej mapie albo pobierz bieżącą pozycję GPS.
      </Text>
      <View style={[layout.toolbar, styles.compactToolbar]}>
        <TextButton title="Pobierz pozycję GPS" disabled={busy} onPress={() => void locateByGps()} />
        {selectedPoint && (
          <TextButton title="Wyczyść punkt" disabled={busy} onPress={() => setSelectedPoint(null)} />
        )}
        {locationBlocked && (
          <TextButton title="Otwórz ustawienia GPS" onPress={() => void Linking.openSettings()} />
        )}
      </View>

      {selectedPoint && (
        <View style={styles.badge}>
          <Text style={styles.badgeTitle}>
            {selectedPoint.source === 'gps' ? 'Źródło: aktualny GPS' : 'Źródło: punkt zaznaczony ręcznie na mapie'}
          </Text>
          <Text style={layout.detail}>
            Współrzędne: {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
            {selectedPoint.accuracy !== null ? ` · dokładność ok. ${Math.round(selectedPoint.accuracy)} m` : ''}
          </Text>
        </View>
      )}

      <Input label="Oznaczenie próbki (np. P-1)" value={sampleLabel} onChangeText={setSampleLabel} maxLength={80} editable={!busy} />
      <View style={styles.rowInputs}>
        <View style={layout.fill}>
          <Input label="Głębokość od (cm)" value={depthFrom} onChangeText={setDepthFrom} keyboardType="numeric" editable={!busy} />
        </View>
        <View style={layout.fill}>
          <Input label="Głębokość do (cm)" value={depthTo} onChangeText={setDepthTo} keyboardType="numeric" editable={!busy} />
        </View>
      </View>
      <Input label="Rodzaj gleby (opcjonalnie)" value={soilType} onChangeText={setSoilType} maxLength={120} editable={!busy} />

      <Text style={layout.detail}>Wyniki badania (opcjonalnie — możesz zostawić puste przy samym pobraniu próbki w polu):</Text>
      <View style={styles.rowInputs}>
        <View style={layout.fill}>
          <Input label="pH (0–14)" value={ph} onChangeText={setPh} keyboardType="decimal-pad" editable={!busy} />
        </View>
        <View style={layout.fill}>
          <Input label="P2O5 (mg/100g)" value={p2O5} onChangeText={setP2O5} keyboardType="decimal-pad" editable={!busy} />
        </View>
      </View>
      <View style={styles.rowInputs}>
        <View style={layout.fill}>
          <Input label="K2O (mg/100g)" value={k2O} onChangeText={setK2O} keyboardType="decimal-pad" editable={!busy} />
        </View>
        <View style={layout.fill}>
          <Input label="Mg (mg/100g)" value={mg} onChangeText={setMg} keyboardType="decimal-pad" editable={!busy} />
        </View>
      </View>
      <Input label="Notatka do punktu (opcjonalnie)" value={pointNotes} onChangeText={setPointNotes} maxLength={500} editable={!busy} />

      <TextButton title="+ Dodaj punkt do szkicu próby" disabled={busy || !selectedPoint} onPress={addPointToDraft} />

      {draftPoints.length > 0 && (
        <View style={styles.draftBox}>
          <Text style={layout.rowTitle}>Punkty w lokalnym szkicu ({draftPoints.length})</Text>
          {draftPoints.map((pt, index) => (
            <View key={`${pt.sampleLabel}-${index}`} style={styles.draftRow}>
              <View style={layout.fill}>
                <Text style={styles.pointTitle}>
                  {pt.sampleLabel} · {pt.locationSource === 'gps' ? 'GPS' : 'Mapa'} ({pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)})
                </Text>
                <Text style={layout.detail}>
                  Głębokość: {pt.depthCmFrom || '0'}–{pt.depthCmTo || '20'} cm
                  {pt.ph ? ` · pH ${pt.ph}` : ' · bez wyników lab.'}
                </Text>
              </View>
              <TextButton title="Usuń" disabled={busy} onPress={() => removeDraftPoint(index)} />
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>2. Dane próby i zapis</Text>
      <Input label="Data pobrania (RRRR-MM-DD)" value={sampleDate} onChangeText={setSampleDate} editable={!busy} />
      <Input label="Laboratorium (opcjonalnie)" value={labName} onChangeText={setLabName} maxLength={240} editable={!busy} />
      <Input label="Uwagi do próby (opcjonalnie)" value={testNotes} onChangeText={setTestNotes} maxLength={1000} editable={!busy} />

      <View style={[layout.toolbar, styles.compactToolbar]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setStatus(current => current === 'DRAFT' ? 'COMPLETED' : 'DRAFT')}
          style={styles.chip}
        >
          <Text style={styles.chipText}>
            Status: {status === 'DRAFT' ? 'Szkic terenowy (DRAFT)' : 'Zakończone badanie (COMPLETED)'}
          </Text>
        </Pressable>
        <TextButton
          title={reminderEnabled ? 'Wyłącz przypomnienie' : 'Przypomnij o szkicu (powiadomienia)'}
          disabled={busy}
          onPress={() => void toggleReminder()}
        />
        {notificationBlocked && (
          <TextButton title="Ustawienia powiadomień" onPress={() => void Linking.openSettings()} />
        )}
      </View>
      {notificationInfo ? <Text style={layout.detail}>{notificationInfo}</Text> : null}

      {targetSoilTestId && (
        <View style={styles.badge}>
          <Text style={layout.detail}>Nowy punkt zostanie dopisany do wybranej istniejącej próby glebowej.</Text>
          <TextButton title="Utwórz jednak nową próbę" onPress={() => setTargetSoilTestId(null)} />
        </View>
      )}

      <Button
        title={busy ? 'Zapisywanie…' : targetSoilTestId ? 'Dopisuj punkt do próby' : 'Zapisz próbę glebową w AgriOps'}
        disabled={busy || (draftPoints.length === 0 && !selectedPoint)}
        onPress={() => void submitSoilSamples()}
      />
      {(draftPoints.length > 0 || labName.trim() || testNotes.trim()) && (
        <TextButton title="Odrzuć lokalny szkic" disabled={busy} onPress={() => void discardDraft()} />
      )}

      {busy && <ActivityIndicator accessibilityLabel="Trwa zapis próbki" color={colors.accent} />}
      {savedBanner ? <Text accessibilityRole="alert" style={styles.success}>{savedBanner}</Text> : null}
      <ErrorMessage message={error} />

      <View style={[layout.heading, { marginTop: 24, marginBottom: 0 }]}>
        <Text style={[layout.rowTitle, layout.fill]}>Zapisane próby glebowe ({tests?.length ?? 0})</Text>
        <TextButton title="Odśwież" onPress={refresh} />
      </View>
      <ErrorMessage message={listError} />
      {!listError && (tests === null
        ? <ActivityIndicator accessibilityLabel="Pobieranie prób glebowych" color={colors.accent} />
        : tests.length === 0 && <Text style={layout.detail}>Brak zapisanych prób glebowych dla tego pola.</Text>)}
      {tests?.map(test => (
        <View key={test.soilTestId} style={layout.row}>
          <View style={layout.fill}>
            <Text style={layout.rowTitle}>
              {test.sampleDate} · {test.status === 'COMPLETED' ? 'Zakończone' : 'Szkic terenowy'}
            </Text>
            <Text style={layout.detail}>
              Punkty: {test.samplePoints.length}
              {test.averagePh != null ? ` · śr. pH ${test.averagePh}` : ''}
              {test.labName ? ` · ${test.labName}` : ''}
            </Text>
            {test.samplePoints.map(pt => (
              <Text key={pt.soilSamplePointId} style={layout.detail}>
                • {pt.sampleLabel}: ({pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)})
                {pt.depthCmFrom != null && pt.depthCmTo != null ? `, ${pt.depthCmFrom}–${pt.depthCmTo} cm` : ''}
                {pt.ph != null ? `, pH ${pt.ph}` : ''}
                {pt.p2O5MgPer100g != null ? `, P ${pt.p2O5MgPer100g}` : ''}
                {pt.k2OMgPer100g != null ? `, K ${pt.k2OMgPer100g}` : ''}
                {pt.mgMgPer100g != null ? `, Mg ${pt.mgMgPer100g}` : ''}
              </Text>
            ))}
            <TextButton
              title={targetSoilTestId === test.soilTestId ? 'Wybrano do dopisania punktu' : 'Dopisz kolejny punkt do tej próby'}
              onPress={() => setTargetSoilTestId(test.soilTestId)}
            />
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 6 },
  compactToolbar: { marginTop: 4 },
  rowInputs: { flexDirection: 'row', gap: 12 },
  badge: {
    backgroundColor: '#eef5ea',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  badgeTitle: { color: colors.accent, fontWeight: '700', fontSize: 14, marginBottom: 2 },
  draftBox: {
    backgroundColor: '#f6f8f4',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 8,
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 8,
  },
  pointTitle: { color: colors.text, fontWeight: '600', fontSize: 14 },
  chip: {
    backgroundColor: '#eaf1e6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  chipText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  success: { color: colors.accent, fontWeight: '600', fontSize: 14, marginVertical: 8 },
});
