import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Button, ErrorMessage, Input, TextButton } from '../components/ui';
import {
  claimPairing, fetchTerminalDashboard, pairingCodeFromUrl, previewPairing, redeemPairing, TerminalApiError,
  type PairingPreview, type TerminalClaim, type TerminalDashboard,
} from '../services/terminalApi';
import { colors, layout } from '../theme';

type Pending = TerminalClaim & { preview: PairingPreview; confirmationNumber?: string };
type StoredTerminal = { token?: string; pending?: Pending };
const storageKey = 'agriops.terminal.v1';
const jobLabels: Record<string, string> = {
  FERTILIZATION: 'Nawożenie', PLANT_PROTECTION: 'Ochrona roślin', CARE: 'Pielęgnacja',
  SEEDING: 'Siew', SOIL_CULTIVATION: 'Uprawa gleby', HARVEST: 'Zbiór', OTHER: 'Inne',
};

async function loadTerminal(): Promise<StoredTerminal> {
  const value = await SecureStore.getItemAsync(storageKey);
  return value ? JSON.parse(value) : {};
}

function saveTerminal(value: StoredTerminal) {
  return SecureStore.setItemAsync(storageKey, JSON.stringify(value));
}

export function TerminalScreen({ code, onPairingCode }: { code: string | null; onPairingCode: (value: string) => void }) {
  const [stored, setStored] = useState<StoredTerminal | null>(null);
  const [preview, setPreview] = useState<PairingPreview | null>(null);
  const [dashboard, setDashboard] = useState<TerminalDashboard | null>(null);
  const [ignoreLink, setIgnoreLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pairingLink, setPairingLink] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const screenLifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    screenLifetime.current = abort;
    return () => abort.abort();
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    async function restore() {
      try {
        const saved = await loadTerminal();
        if (abort.signal.aborted) return;
        setStored(saved);
        if (code && saved.pending?.code !== code && !ignoreLink) {
          const incoming = await previewPairing(code, abort.signal);
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
  }, [code, attempt, ignoreLink]);

  const incomingCode = ignoreLink ? null : code;
  const pending = stored?.pending && (!incomingCode || stored.pending.code === incomingCode) ? stored.pending : undefined;
  const activeToken = loaded && !incomingCode && !pending ? stored?.token : undefined;

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
            await SecureStore.deleteItemAsync(storageKey);
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

  async function connect() {
    const signal = screenLifetime.current?.signal;
    if (busy || !stored || !signal || signal.aborted) return;
    const details = pending?.preview ?? preview;
    if (!details || (!pending && !incomingCode)) return;
    setBusy(true);
    setError('');
    try {
      const draft = pending ?? {
        code: incomingCode!,
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

  const details = pending?.preview ?? preview;
  return (
    <ScrollView contentContainerStyle={[layout.content, styles.content]}>
      <Text accessibilityRole="header" style={styles.heading}>{dashboard ? dashboard.machineName : 'Terminal ciągnika'}</Text>
      {(!loaded || (activeToken && !dashboard && !error)) && <ActivityIndicator color={colors.accent} />}
      {details && (
        <>
          <Text style={layout.detail}>{details.farmName}</Text>
          <Text style={styles.subheading}>{details.machineName}</Text>
          {pending?.confirmationNumber ? (
            <>
              <Text style={layout.detail}>Porównaj ten numer z numerem na karcie ciągnika i zatwierdź urządzenie w przeglądarce.</Text>
              <Text selectable accessibilityLiveRegion="polite" style={styles.number}>{pending.confirmationNumber}</Text>
            </>
          ) : <Button title="Połącz jako terminal" onPress={() => void connect()} disabled={busy} />}
        </>
      )}
      {dashboard && (
        <>
          <Text style={layout.detail}>{dashboard.farmName}</Text>
          <Text accessibilityRole="header" style={styles.subheading}>Zaplanowane zlecenia</Text>
          {dashboard.jobs.length === 0 && <Text style={layout.detail}>Brak zleceń przypisanych do tego ciągnika.</Text>}
          {dashboard.jobs.map(job => (
            <View style={layout.row} key={job.id}>
              <View style={layout.fill}>
                <Text style={styles.job}>{jobLabels[job.type] ?? job.type}</Text>
                <Text style={layout.detail}>{job.date}{job.isAllDay || !job.startTime ? '' : ` · ${job.startTime.slice(0, 5)}`}</Text>
              </View>
            </View>
          ))}
          <TextButton title="Odśwież zlecenia" onPress={() => setAttempt(value => value + 1)} />
        </>
      )}
      {loaded && !details && !activeToken && (
        <>
          <Text style={layout.detail}>Na karcie ciągnika wybierz „Sparuj terminal” i zeskanuj kod aparatem. Jeśli link otworzy się w przeglądarce, skopiuj go z paska adresu i wklej tutaj.</Text>
          <Input label="Link parowania" value={pairingLink} onChangeText={setPairingLink}
            autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <TextButton title="Otwórz link parowania" disabled={!pairingLink.trim()} onPress={() => {
            const parsed = pairingCodeFromUrl(pairingLink.trim());
            if (!parsed || parsed === code) {
              setError(parsed ? 'Poproś właściciela o nowy kod QR.' : 'Wklej pełny link parowania z domeny AgriOps.');
              return;
            }
            setPairingLink('');
            onPairingCode(parsed);
          }} />
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
});
