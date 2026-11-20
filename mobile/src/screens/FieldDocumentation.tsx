import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorMessage, Input, TextButton } from '../components/ui';
import { config } from '../config';
import {
  AgriOpsApi,
  type Field,
  type FieldOperationItem,
  type MachineItem,
  type OwnerPairingStart,
  type OwnerPairingStatus,
} from '../services/agriOpsApi';
import { colors, layout } from '../theme';

type Props = {
  api: AgriOpsApi;
  farmId: string;
  farmName: string;
  fields: Field[];
  initialFieldId?: string | null;
  onBack: () => void;
};

const operationLabels: Record<string, string> = {
  SOIL_CULTIVATION: 'Uprawa gleby',
  FERTILIZATION: 'Nawożenie',
  PLANT_PROTECTION: 'Ochrona roślin',
  SEEDING: 'Siew',
  CARE: 'Pielęgnacja',
  HARVEST: 'Zbiór',
  OTHER: 'Inne prace',
};

const statusLabels: Record<string, string> = {
  PLANNED: 'Zaplanowane',
  COMPLETED: 'Wykonane (zatwierdzone)',
  CANCELLED: 'Anulowane',
};

const message = (error: unknown) => error instanceof Error ? error.message : 'Spróbuj ponownie.';
const todayIso = () => new Date().toISOString().slice(0, 10);

export function FieldDocumentation({ api, farmId, farmName, fields, initialFieldId = null, onBack }: Props) {
  const [operations, setOperations] = useState<FieldOperationItem[] | null>(null);
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [filterFieldId, setFilterFieldId] = useState<string | null>(initialFieldId);
  const [attempt, setAttempt] = useState(0);
  const [listError, setListError] = useState('');

  const [selectedFieldId, setSelectedFieldId] = useState<string>(initialFieldId ?? fields[0]?.fieldId ?? '');
  const [operationDate, setOperationDate] = useState(todayIso);
  const [startTime, setStartTime] = useState('08:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [tractorId, setTractorId] = useState('');
  const [implementId, setImplementId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const [pairingTractorId, setPairingTractorId] = useState('');
  const [pairing, setPairing] = useState<OwnerPairingStart | null>(null);
  const [pairingStatus, setPairingStatus] = useState<OwnerPairingStatus | null>(null);
  const [pairingError, setPairingError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [ops, machs] = await Promise.all([
          api.operations(farmId, filterFieldId ?? undefined),
          api.machines(farmId),
        ]);
        if (!active) return;
        setOperations(ops);
        const activeMachines = machs.filter(m => m.isActive);
        setMachines(activeMachines);
        const firstTractor = activeMachines.find(m => m.type === 'TRACTOR');
        if (firstTractor) {
          setTractorId(current => current || firstTractor.machineId);
          setPairingTractorId(current => current || firstTractor.machineId);
        }
      } catch (e) {
        if (active) setListError(message(e));
      }
    }
    void load();
    return () => { active = false; };
  }, [api, farmId, filterFieldId, attempt]);

  useEffect(() => {
    if (!pairing || !pairingTractorId || pairingStatus?.state === 'approved' || pairingStatus?.state === 'closed') {
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const current = await api.terminalPairingStatus(farmId, pairingTractorId, pairing!.pairingId);
        if (!active) return;
        setPairingStatus(current);
      } catch (e) {
        if (active) setPairingError(message(e));
      } finally {
        if (active) timer = setTimeout(poll, 2500);
      }
    }
    timer = setTimeout(poll, 1500);
    return () => { active = false; clearTimeout(timer); };
  }, [api, farmId, pairing, pairingTractorId, pairingStatus?.state]);

  const tractors = machines.filter(m => m.type === 'TRACTOR');
  const implementsList = machines.filter(m => m.type !== 'TRACTOR');

  async function createJob() {
    if (busy) return;
    setError('');
    setSavedMessage('');
    if (!selectedFieldId) {
      setError('Wybierz pole dla zlecenia uprawy gleby.');
      return;
    }
    if (!tractorId) {
      setError('Wybierz aktywny ciągnik.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(operationDate.trim())) {
      setError('Podaj termin w formacie RRRR-MM-DD.');
      return;
    }
    const targetField = fields.find(f => f.fieldId === selectedFieldId);
    setBusy(true);
    try {
      await api.createSoilCultivationJob(farmId, {
        fieldId: selectedFieldId,
        areaHa: targetField?.powierzchnia ?? null,
        operationDate: operationDate.trim(),
        startTime: isAllDay ? null : `${startTime.trim()}:00`.slice(0, 8),
        isAllDay,
        tractorMachineId: tractorId,
        implementMachineId: implementId || null,
        notes: notes.trim() || null,
      });
      setNotes('');
      setSavedMessage('Zlecenie uprawy gleby zostało utworzone i przypisane do ciągnika.');
      setAttempt(value => value + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function approveJob(operationId: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setSavedMessage('');
    try {
      await api.approveOperation(farmId, operationId);
      setSavedMessage('Wykonanie zlecenia zostało zatwierdzone przez właściciela.');
      setAttempt(value => value + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function startPairing() {
    if (busy || !pairingTractorId) return;
    setBusy(true);
    setPairingError('');
    try {
      const next = await api.startTerminalPairing(farmId, pairingTractorId);
      setPairing(next);
      setPairingStatus({ state: 'open', confirmationNumber: null });
    } catch (e) {
      setPairingError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmPairing() {
    if (busy || !pairing || !pairingTractorId || !pairingStatus?.confirmationNumber) return;
    setBusy(true);
    setPairingError('');
    try {
      await api.approveTerminalPairing(
        farmId,
        pairingTractorId,
        pairing.pairingId,
        pairingStatus.confirmationNumber,
      );
      setPairingStatus({ state: 'approved', confirmationNumber: null });
    } catch (e) {
      setPairingError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const pairingLink = pairing
    ? `${config.appOrigin.replace(/\/$/, '')}/terminal/pair#${pairing.code}`
    : '';

  return (
    <>
      <TextButton title="Wróć do pól" onPress={onBack} />
      <Text style={layout.title}>Dokumentacja i zlecenia</Text>
      <Text style={layout.subtitle}>{farmName}</Text>

      <Text style={styles.sectionTitle}>1. Zaplanuj zlecenie uprawy gleby</Text>
      <Text style={layout.detail}>Wybierz pole, termin, ciągnik i narzędzie (np. agregat uprawowy):</Text>

      <Text style={styles.label}>Pole</Text>
      <View style={styles.selectorGroup}>
        {fields.map(field => (
          <Pressable
            key={field.fieldId}
            accessibilityRole="button"
            onPress={() => setSelectedFieldId(field.fieldId)}
            style={[styles.chip, selectedFieldId === field.fieldId && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selectedFieldId === field.fieldId && styles.chipTextSelected]}>
              {field.nazwa} ({field.powierzchnia} ha)
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.rowInputs}>
        <View style={layout.fill}>
          <Input label="Termin (RRRR-MM-DD)" value={operationDate} onChangeText={setOperationDate} editable={!busy} />
        </View>
        {!isAllDay && (
          <View style={layout.fill}>
            <Input label="Godzina (GG:MM)" value={startTime} onChangeText={setStartTime} editable={!busy} />
          </View>
        )}
      </View>
      <TextButton
        title={isAllDay ? 'Zmień na konkretną godzinę' : 'Ustaw jako cały dzień'}
        onPress={() => setIsAllDay(current => !current)}
      />

      <Text style={styles.label}>Ciągnik</Text>
      {tractors.length === 0 ? (
        <Text style={layout.detail}>Brak aktywnych ciągników w gospodarstwie.</Text>
      ) : (
        <View style={styles.selectorGroup}>
          {tractors.map(tractor => (
            <Pressable
              key={tractor.machineId}
              accessibilityRole="button"
              onPress={() => setTractorId(tractor.machineId)}
              style={[styles.chip, tractorId === tractor.machineId && styles.chipSelected]}
            >
              <Text style={[styles.chipText, tractorId === tractor.machineId && styles.chipTextSelected]}>
                {tractor.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {implementsList.length > 0 && (
        <>
          <Text style={styles.label}>Narzędzie / agregat (opcjonalnie)</Text>
          <View style={styles.selectorGroup}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setImplementId('')}
              style={[styles.chip, !implementId && styles.chipSelected]}
            >
              <Text style={[styles.chipText, !implementId && styles.chipTextSelected]}>Bez narzędzia</Text>
            </Pressable>
            {implementsList.map(tool => (
              <Pressable
                key={tool.machineId}
                accessibilityRole="button"
                onPress={() => setImplementId(tool.machineId)}
                style={[styles.chip, implementId === tool.machineId && styles.chipSelected]}
              >
                <Text style={[styles.chipText, implementId === tool.machineId && styles.chipTextSelected]}>
                  {tool.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Input label="Uwaga dla operatora (opcjonalnie)" value={notes} onChangeText={setNotes} maxLength={1000} editable={!busy} />
      <Button title={busy ? 'Zapisywanie…' : 'Utwórz zlecenie dla ciągnika'} disabled={busy || !tractorId || !selectedFieldId} onPress={() => void createJob()} />

      <Text style={styles.sectionTitle}>2. Parowanie terminala ciągnika (QR / kod)</Text>
      <Text style={layout.detail}>
        Możesz wygenerować jednorazowy kod parowania dla wybranego ciągnika i zatwierdzić 6-cyfrowy numer z tabletu/telefonu:
      </Text>
      {tractors.length > 0 && (
        <View style={styles.selectorGroup}>
          {tractors.map(tractor => (
            <Pressable
              key={tractor.machineId}
              accessibilityRole="button"
              onPress={() => setPairingTractorId(tractor.machineId)}
              style={[styles.chip, pairingTractorId === tractor.machineId && styles.chipSelected]}
            >
              <Text style={[styles.chipText, pairingTractorId === tractor.machineId && styles.chipTextSelected]}>
                {tractor.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <TextButton title="Wygeneruj jednorazowy kod parowania (ważny 5 min)" disabled={busy || !pairingTractorId} onPress={() => void startPairing()} />
      {pairing && (
        <View style={styles.pairingBox}>
          <Text style={layout.detail}>Link parowania (do QR lub wklejenia na terminalu):</Text>
          <Text selectable style={styles.codeText}>{pairingLink}</Text>
          <Text style={layout.detail}>Stan parowania: {pairingStatus?.state ?? 'open'}</Text>
          {pairingStatus?.confirmationNumber && (
            <>
              <Text style={layout.detail}>Porównaj 6-cyfrowy numer z ekranem terminala:</Text>
              <Text selectable style={styles.confirmationNumber}>{pairingStatus.confirmationNumber}</Text>
              <Button title="Zatwierdź urządzenie terminala" disabled={busy} onPress={() => void confirmPairing()} />
            </>
          )}
          {pairingStatus?.state === 'approved' && (
            <Text style={styles.success}>Terminal został sparowany i otrzymał sesję.</Text>
          )}
        </View>
      )}
      <ErrorMessage message={pairingError} />

      {savedMessage ? <Text accessibilityRole="alert" style={styles.success}>{savedMessage}</Text> : null}
      <ErrorMessage message={error} />

      <View style={[layout.heading, { marginTop: 24, marginBottom: 4 }]}>
        <Text style={[layout.rowTitle, layout.fill]}>Dokumentacja zabiegów i zlecenia</Text>
        <TextButton title="Odśwież" onPress={() => setAttempt(v => v + 1)} />
      </View>
      <View style={styles.selectorGroup}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFilterFieldId(null)}
          style={[styles.chip, filterFieldId === null && styles.chipSelected]}
        >
          <Text style={[styles.chipText, filterFieldId === null && styles.chipTextSelected]}>Wszystkie pola</Text>
        </Pressable>
        {fields.map(field => (
          <Pressable
            key={field.fieldId}
            accessibilityRole="button"
            onPress={() => setFilterFieldId(field.fieldId)}
            style={[styles.chip, filterFieldId === field.fieldId && styles.chipSelected]}
          >
            <Text style={[styles.chipText, filterFieldId === field.fieldId && styles.chipTextSelected]}>{field.nazwa}</Text>
          </Pressable>
        ))}
      </View>

      <ErrorMessage message={listError} />
      {!listError && (operations === null
        ? <ActivityIndicator accessibilityLabel="Pobieranie dokumentacji" color={colors.accent} />
        : operations.length === 0 && <Text style={layout.detail}>Brak zapisanych zabiegów ani zleceń dla wybranego zakresu.</Text>)}

      {operations?.map(op => (
        <View key={op.fieldOperationId} style={layout.row}>
          <View style={layout.fill}>
            <Text style={layout.rowTitle}>
              {operationLabels[op.operationType] ?? op.operationType} · {op.operationDate}
              {!op.isAllDay && op.startTime ? ` (${op.startTime.slice(0, 5)})` : ''}
            </Text>
            <Text style={layout.detail}>
              Status: {statusLabels[op.status] ?? op.status}
              {op.totalAreaHa > 0 ? ` · ${op.totalAreaHa} ha` : ''}
            </Text>
            {op.fieldNames.length > 0 && (
              <Text style={layout.detail}>Pola: {op.fieldNames.join(', ')}</Text>
            )}
            {op.machineNames.length > 0 && (
              <Text style={layout.detail}>Maszyny: {op.machineNames.join(', ')}</Text>
            )}
            {op.notes && <Text style={layout.detail}>Uwagi / raport: {op.notes}</Text>}
            {op.status === 'PLANNED' && (
              <TextButton
                title="Zatwierdź wykonanie zlecenia"
                disabled={busy}
                onPress={() => void approveJob(op.fieldOperationId)}
              />
            )}
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 6 },
  label: { color: colors.muted, fontSize: 13, marginTop: 8, marginBottom: 6 },
  rowInputs: { flexDirection: 'row', gap: 12 },
  selectorGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#f6f8f4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chipSelected: {
    backgroundColor: '#eaf1e6',
    borderColor: colors.accent,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: colors.accent, fontWeight: '700' },
  pairingBox: {
    backgroundColor: '#f6f8f4',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 6,
  },
  codeText: { color: colors.text, fontSize: 12, fontFamily: 'monospace' },
  confirmationNumber: { color: colors.accent, fontSize: 30, fontWeight: '800', letterSpacing: 4 },
  success: { color: colors.accent, fontWeight: '600', fontSize: 14, marginVertical: 8 },
});
