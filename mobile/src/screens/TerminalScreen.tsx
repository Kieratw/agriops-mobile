import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getRandomBytesAsync } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Button, ErrorMessage, Input, TextButton } from '../components/ui';
import { FieldsMap } from '../map/FieldsMap';
import {
  loadTerminalJobReports,
  saveTerminalJobReports,
  SECURE_KEYS,
  SECURE_STORE_OPTIONS,
  type TerminalJobReportDraft,
} from '../services/secureDrafts';
import {
  claimPairing,
  fetchTerminalDashboard,
  pairingCodeFromInput,
  previewPairing,
  redeemPairing,
  TerminalApiError,
  type PairingPreview,
  type TerminalClaim,
  type TerminalDashboard,
} from '../services/terminalApi';
import { colors, layout } from '../theme';

type Pending = TerminalClaim & { preview: PairingPreview; confirmationNumber?: string };
type StoredTerminal = { token?: string; pending?: Pending };
const storageKey = SECURE_KEYS.terminalSession;
const jobLabels: Record<string, string> = {
  FERTILIZATION: 'Nawożenie', PLANT_PROTECTION: 'Ochrona roślin', CARE: 'Pielęgnacja',
  SEEDING: 'Siew', SOIL_CULTIVATION: 'Uprawa gleby', HARVEST: 'Zbiór', OTHER: 'Inne',
};

async function loadTerminal(): Promise<StoredTerminal> {
  const value = await SecureStore.getItemAsync(storageKey, SECURE_STORE_OPTIONS);
  return value ? JSON.parse(value) : {};
}

function saveTerminal(value: StoredTerminal) {
  return SecureStore.setItemAsync(storageKey, JSON.stringify(value), SECURE_STORE_OPTIONS);
}

function createQrDecoderHtml(dataUri: string): string {
  const escaped = JSON.stringify(dataUri).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="pl"><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; img-src data:; connect-src 'none';">
<script src="https://unpkg.com/jsqr@1.4.0/dist/jsQR.js" integrity="sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx" crossorigin="anonymous"></script>
</head><body><script>
(async function() {
  function post(payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  try {
    const img = new Image();
    img.src = ${escaped};
    await new Promise(function(resolve, reject) { img.onload = resolve; img.onerror = reject; });
    if (typeof BarcodeDetector !== 'undefined') {
      try {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const codes = await detector.detect(img);
        if (codes && codes.length > 0 && codes[0].rawValue) {
          post({ type: 'qrResult', value: codes[0].rawValue });
          return;
        }
      } catch (e) {}
    }
    if (typeof jsQR === 'function') {
      const canvas = document.createElement('canvas');
      const maxDim = 1024;
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(imageData.data, imageData.width, imageData.height);
      if (found && found.data) {
        post({ type: 'qrResult', value: found.data });
        return;
      }
    }
    post({ type: 'qrResult', value: null });
  } catch (e) {
    post({ type: 'qrResult', value: null });
  }
})();
</script></body></html>`;
}

export function TerminalScreen({ code }: { code: string | null }) {
  const [stored, setStored] = useState<StoredTerminal | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [qrImageUri, setQrImageUri] = useState<string | null>(null);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [preview, setPreview] = useState<PairingPreview | null>(null);
  const [dashboard, setDashboard] = useState<TerminalDashboard | null>(null);
  const [reports, setReports] = useState<Record<string, TerminalJobReportDraft>>({});
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [areaHa, setAreaHa] = useState('');
  const [hours, setHours] = useState('');
  const [jobNote, setJobNote] = useState('');
  const [reportNotice, setReportNotice] = useState('');
  const [ignoreLink, setIgnoreLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const screenLifetime = useRef<AbortController | null>(null);

  const effectiveCode = scannedCode ?? (ignoreLink ? null : code);

  useEffect(() => {
    const abort = new AbortController();
    screenLifetime.current = abort;
    void loadTerminalJobReports(SecureStore).then(savedReports => {
      if (!abort.signal.aborted) setReports(savedReports);
    }).catch(() => {});
    return () => abort.abort();
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    async function restore() {
      try {
        const saved = await loadTerminal();
        if (abort.signal.aborted) return;
        setStored(saved);
        if (effectiveCode && saved.pending?.code !== effectiveCode) {
          const incoming = await previewPairing(effectiveCode, abort.signal);
          if (!abort.signal.aborted) setPreview(incoming);
        }
      } catch (e) {
        if (!abort.signal.aborted) setError(message(e));
      } finally {
        if (!abort.signal.aborted) setLoaded(true);
      }
    }
    void restore();
    return () => abort.abort();
  }, [effectiveCode, attempt]);

  const pending = stored?.pending && (!effectiveCode || stored.pending.code === effectiveCode) ? stored.pending : undefined;
  const activeToken = loaded && !effectiveCode && !pending ? stored?.token : undefined;

  useEffect(() => {
    if (!pending?.confirmationNumber || !stored) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const session = await redeemPairing({ code: pending!.code, secret: pending!.secret }, abort.signal);
        if (abort.signal.aborted) return;
        if (session) {
          const next = { token: session.token };
          await saveTerminal(next);
          if (abort.signal.aborted) return;
          setStored(next);
          setScannedCode(null);
          setIgnoreLink(true);
          setPreview(null);
          setError('');
          return;
        }
        setError('');
      } catch (e) {
        if (abort.signal.aborted) return;
        if (e instanceof TerminalApiError && e.status === 410) {
          const next = { token: stored?.token };
          try {
            await saveTerminal(next);
            if (abort.signal.aborted) return;
            setStored(next);
            setScannedCode(null);
            setIgnoreLink(true);
            setPreview(null);
            setError(message(e));
            return;
          } catch (storageError) {
            if (abort.signal.aborted) return;
            setError(message(storageError));
          }
        } else {
          setError(message(e));
        }
      }
      if (!abort.signal.aborted) timer = setTimeout(poll, 3000);
    }
    void poll();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [pending, stored]);

  useEffect(() => {
    if (!activeToken) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const result = await fetchTerminalDashboard(activeToken!, abort.signal);
        if (abort.signal.aborted) return;
        setDashboard(result);
        setError('');
      } catch (e) {
        if (abort.signal.aborted) return;
        if (e instanceof TerminalApiError && e.status === 401) {
          setDashboard(null);
          setError('Sesja terminala została zakończona. Zeskanuj nowy kod QR.');
          try {
            await SecureStore.deleteItemAsync(storageKey, SECURE_STORE_OPTIONS);
            if (!abort.signal.aborted) setStored({});
            return;
          } catch (storageError) {
            if (!abort.signal.aborted) setError(message(storageError));
          }
        } else {
          setError(message(e));
        }
      }
      if (!abort.signal.aborted) timer = setTimeout(refresh, 15000);
    }
    void refresh();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [activeToken, attempt]);

  async function scanQrImage(useCamera: boolean) {
    setBusy(true);
    setError('');
    setCameraBlocked(false);
    try {
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setCameraBlocked(!permission.canAskAgain);
          setError(
            permission.canAskAgain
              ? 'Brak zgody na aparat. Możesz wybrać zdjęcie kodu QR z galerii lub wkleić link parowania ręcznie.'
              : 'Dostęp do aparatu jest zablokowany w ustawieniach Androida. Otwórz ustawienia albo wklej link parowania poniżej.',
          );
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.85,
        base64: true,
        exif: false,
      };
      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        setError('Nie udało się odczytać obrazu kodu QR. Spróbuj ponownie lub wklej link parowania.');
        return;
      }
      const mime = asset.mimeType && /^image\/(jpeg|png|webp)$/i.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
      setQrImageUri(`data:${mime};base64,${asset.base64}`);
    } catch {
      setError('Nie udało się uruchomić skanowania QR. Możesz wkleić link lub kod parowania poniżej.');
    } finally {
      setBusy(false);
    }
  }

  function handleQrDecoded(event: WebViewMessageEvent) {
    setQrImageUri(null);
    try {
      const payload = JSON.parse(event.nativeEvent.data) as { type?: string; value?: string | null };
      if (payload?.type !== 'qrResult') return;
      if (!payload.value) {
        setError('Nie wykryto kodu QR na zdjęciu. Upewnij się, że kod jest wyraźny, lub wklej link parowania.');
        return;
      }
      const parsed = pairingCodeFromInput(payload.value);
      if (!parsed) {
        setError('Zeskanowany kod QR nie jest prawidłowym linkiem parowania AgriOps.');
        return;
      }
      setError('');
      setIgnoreLink(false);
      setScannedCode(parsed);
    } catch {
      setError('Nie udało się odczytać kodu QR.');
    }
  }

  function applyManualCode() {
    setError('');
    const parsed = pairingCodeFromInput(manualInput);
    if (!parsed) {
      setError('Podaj prawidłowy link HTTPS parowania (/terminal/pair#...) lub 43-znakowy kod jednorazowy.');
      return;
    }
    if (parsed === code) {
      setError('Poproś właściciela o nowy kod QR.');
      return;
    }
    setManualInput('');
    setIgnoreLink(false);
    setScannedCode(parsed);
  }

  async function connect() {
    const signal = screenLifetime.current?.signal;
    if (busy || !stored || !signal || signal.aborted) return;
    const details = pending?.preview ?? preview;
    if (!details || (!pending && !effectiveCode)) return;
    setBusy(true);
    setError('');
    try {
      const draft = pending ?? {
        code: effectiveCode!,
        secret: Array.from(await getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join(''),
        preview: details,
      };
      const next = { ...stored, pending: draft };
      if (signal.aborted) return;
      await saveTerminal(next);
      if (signal.aborted) return;
      setStored(next);
      const { confirmationNumber } = await claimPairing({ code: draft.code, secret: draft.secret }, signal);
      if (signal.aborted) return;
      const claimed = { ...next, pending: { ...draft, confirmationNumber } };
      await saveTerminal(claimed);
      if (!signal.aborted) setStored(claimed);
    } catch (e) {
      if (signal.aborted) return;
      if (e instanceof TerminalApiError && e.status === 410) {
        const next = { token: stored.token };
        try {
          await saveTerminal(next);
          if (signal.aborted) return;
          setStored(next);
          setScannedCode(null);
          setIgnoreLink(true);
          setPreview(null);
        } catch (storageError) {
          if (!signal.aborted) setError(message(storageError));
          return;
        }
      }
      setError(message(e));
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }

  async function startJob(jobId: string) {
    setReportNotice('');
    const existing = reports[jobId];
    const updated: Record<string, TerminalJobReportDraft> = {
      ...reports,
      [jobId]: {
        jobId,
        startedAtUtc: existing?.startedAtUtc ?? new Date().toISOString(),
        finishedAtUtc: null,
        areaHa: existing?.areaHa ?? '',
        hours: existing?.hours ?? '',
        note: existing?.note ?? '',
        submittedAtUtc: null,
      },
    };
    setReports(updated);
    setActiveJobId(jobId);
    setAreaHa(updated[jobId].areaHa);
    setHours(updated[jobId].hours);
    setJobNote(updated[jobId].note);
    await saveTerminalJobReports(SecureStore, updated).catch(() => {});
  }

  async function finishJobReport(jobId: string) {
    setError('');
    setReportNotice('');
    const parsedArea = areaHa.trim() ? Number(areaHa.trim().replace(',', '.')) : null;
    const parsedHours = hours.trim() ? Number(hours.trim().replace(',', '.')) : null;
    if ((parsedArea !== null && (!Number.isFinite(parsedArea) || parsedArea <= 0)) ||
        (parsedHours !== null && (!Number.isFinite(parsedHours) || parsedHours <= 0))) {
      setError('Czas pracy i powierzchnia w raporcie muszą być dodatnimi liczbami.');
      return;
    }
    const now = new Date().toISOString();
    const existing = reports[jobId];
    const updated: Record<string, TerminalJobReportDraft> = {
      ...reports,
      [jobId]: {
        jobId,
        startedAtUtc: existing?.startedAtUtc ?? now,
        finishedAtUtc: now,
        areaHa: areaHa.trim(),
        hours: hours.trim(),
        note: jobNote.trim(),
        submittedAtUtc: now,
      },
    };
    setReports(updated);
    setActiveJobId(null);
    await saveTerminalJobReports(SecureStore, updated).catch(() => {});
    setReportNotice('Raport zapisano tylko lokalnie na tym urządzeniu (SecureStore). Wysyłka do AgriOps i zatwierdzenie przez właściciela wymagają endpointu serwera dla terminala — nie są jeszcze dostępne.');
  }

  async function disconnectLocalTerminal() {
    await SecureStore.deleteItemAsync(storageKey, SECURE_STORE_OPTIONS).catch(() => {});
    await SecureStore.deleteItemAsync(SECURE_KEYS.terminalReports, SECURE_STORE_OPTIONS).catch(() => {});
    setStored({});
    setDashboard(null);
    setPreview(null);
    setScannedCode(null);
    setReports({});
    setError('');
  }

  const qrDecoderSource = useMemo(
    () => (qrImageUri ? { html: createQrDecoderHtml(qrImageUri), baseUrl: 'https://qr.agriops.invalid/' } : null),
    [qrImageUri],
  );

  const details = pending?.preview ?? preview;
  return (
    <ScrollView contentContainerStyle={[layout.content, styles.content]} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.heading}>{dashboard ? dashboard.machineName : 'Terminal ciągnika'}</Text>
      {(!loaded || (activeToken && !dashboard && !error)) && <ActivityIndicator color={colors.accent} />}

      {qrDecoderSource && (
        <View style={styles.hiddenDecoder}>
          <WebView
            source={qrDecoderSource}
            originWhitelist={['about:*', 'https://qr.agriops.invalid*', 'https://unpkg.com/jsqr@1.4.0/*']}
            onShouldStartLoadWithRequest={request =>
              request.url === 'about:blank' || request.url.startsWith('https://qr.agriops.invalid/')}
            javaScriptEnabled
            domStorageEnabled={false}
            incognito
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled={false}
            allowFileAccess={false}
            geolocationEnabled={false}
            onMessage={handleQrDecoded}
          />
        </View>
      )}

      {details && (
        <>
          <Text style={layout.detail}>{details.farmName}</Text>
          <Text style={styles.subheading}>{details.machineName}</Text>
          {pending?.confirmationNumber ? (
            <>
              <Text style={layout.detail}>Porównaj ten numer z numerem na karcie ciągnika i zatwierdź urządzenie w przeglądarce lub u właściciela.</Text>
              <Text selectable accessibilityLiveRegion="polite" style={styles.number}>{pending.confirmationNumber}</Text>
            </>
          ) : <Button title="Połącz jako terminal" onPress={() => void connect()} disabled={busy} />}
        </>
      )}

      {dashboard && (
        <>
          <Text style={layout.detail}>{dashboard.farmName}</Text>
          <FieldsMap />
          <Text accessibilityRole="header" style={styles.subheading}>Zaplanowane zlecenia</Text>
          {dashboard.jobs.length === 0 && <Text style={layout.detail}>Brak zleceń przypisanych do tego ciągnika.</Text>}
          {dashboard.jobs.map(job => {
            const report = reports[job.id];
            const isEditing = activeJobId === job.id;
            return (
              <View style={layout.row} key={job.id}>
                <View style={layout.fill}>
                  <Text style={styles.job}>{jobLabels[job.type] ?? job.type}</Text>
                  <Text style={layout.detail}>{job.date}{job.isAllDay || !job.startTime ? '' : ` · ${job.startTime.slice(0, 5)}`}</Text>
                  {report && (
                    <Text style={styles.reportSummary}>
                      Status lokalny (niewysłany do AgriOps): {report.finishedAtUtc ? 'Zakończono, raport zapisany lokalnie' : 'W trakcie realizacji'}
                      {report.areaHa ? ` · ${report.areaHa} ha` : ''}
                      {report.hours ? ` · ${report.hours} h` : ''}
                      {report.note ? ` · „${report.note}”` : ''}
                    </Text>
                  )}
                  {!isEditing ? (
                    <TextButton
                      title={report?.finishedAtUtc ? 'Edytuj raport wykonania' : report ? 'Dokończ raport pracy' : 'Rozpocznij pracę'}
                      onPress={() => void startJob(job.id)}
                    />
                  ) : (
                    <View style={styles.reportBox}>
                      <Text style={layout.detail}>Raport wykonania pracy ciągnika (chroniony szkic lokalny):</Text>
                      <Input label="Wykonana powierzchnia (ha)" value={areaHa} onChangeText={setAreaHa} keyboardType="decimal-pad" />
                      <Input label="Czas pracy (godz.)" value={hours} onChangeText={setHours} keyboardType="decimal-pad" />
                      <Input label="Uwaga z pola (opcjonalnie)" value={jobNote} onChangeText={setJobNote} maxLength={500} />
                      <Button title="Zakończ pracę i zapisz raport" onPress={() => void finishJobReport(job.id)} />
                      <TextButton title="Zwiń formularz (zachowaj szkic)" onPress={() => setActiveJobId(null)} />
                    </View>
                  )}
                </View>
              </View>
            );
          })}
          {reportNotice ? <Text style={styles.notice}>{reportNotice}</Text> : null}
          <View style={layout.toolbar}>
            <TextButton title="Odśwież zlecenia" onPress={() => setAttempt(value => value + 1)} />
            <TextButton title="Odłącz terminal lokalnie" onPress={() => void disconnectLocalTerminal()} />
          </View>
        </>
      )}

      {loaded && !details && !activeToken && (
        <>
          <Text style={layout.detail}>
            Na karcie ciągnika w AgriOps wybierz „Sparuj terminal”. Możesz zeskanować kod QR aparatem w aplikacji, wybrać zdjęcie kodu QR z galerii lub wkleić link parowania.
          </Text>
          <View style={layout.toolbar}>
            <Button title="Zeskanuj kod QR aparatem" disabled={busy} onPress={() => void scanQrImage(true)} />
            <TextButton title="Wybierz QR z galerii" disabled={busy} onPress={() => void scanQrImage(false)} />
            {cameraBlocked && (
              <TextButton title="Otwórz ustawienia aparatu" onPress={() => void Linking.openSettings()} />
            )}
          </View>
          <Input
            label="Link parowania lub 43-znakowy kod QR"
            value={manualInput}
            onChangeText={setManualInput}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
          <TextButton title="Sprawdź wpisany kod parowania" disabled={busy || !manualInput.trim()} onPress={applyManualCode} />
        </>
      )}

      <ErrorMessage message={error} />
      {error && !details && !dashboard && !ignoreLink && (
        <TextButton title="Spróbuj ponownie" onPress={() => { setError(''); setAttempt(value => value + 1); }} />
      )}
    </ScrollView>
  );
}

function message(error: unknown) {
  return error instanceof TerminalApiError ? error.message : 'Nie udało się połączyć lub zapisać sesji. Spróbuj ponownie.';
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, gap: 12 },
  heading: { color: colors.text, fontSize: 27, fontWeight: '800' },
  subheading: { color: colors.text, fontSize: 20, fontWeight: '700' },
  number: { color: colors.accent, fontSize: 36, fontWeight: '800', letterSpacing: 6 },
  job: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hiddenDecoder: { width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  reportBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f6f8f4',
    borderWidth: 1,
    borderColor: colors.line,
  },
  reportSummary: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 4 },
  notice: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
