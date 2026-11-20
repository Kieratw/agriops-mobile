export type StorageAdapter = {
  getItemAsync: (key: string, options?: Record<string, unknown>) => Promise<string | null>;
  setItemAsync: (key: string, value: string, options?: Record<string, unknown>) => Promise<void>;
  deleteItemAsync: (key: string, options?: Record<string, unknown>) => Promise<void>;
};

export type LocationSource = 'gps' | 'manual';

export type SoilSampleDraftPoint = {
  sampleLabel: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters: number | null;
  locationSource: LocationSource;
  depthCmFrom: string;
  depthCmTo: string;
  soilType: string;
  ph: string;
  p2O5: string;
  k2O: string;
  mg: string;
  notes: string;
};

export type SoilSampleDraft = {
  farmId: string;
  fieldId: string;
  sampleDate: string;
  labName: string;
  status: 'DRAFT' | 'COMPLETED';
  notes: string;
  reminderEnabled: boolean;
  updatedAtUtc: string;
  points: SoilSampleDraftPoint[];
};

export type ObservationDraft = {
  farmId: string;
  fieldId: string;
  fieldCropId: string;
  note: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationSource: LocationSource | null;
  updatedAtUtc: string;
};

export type TerminalJobReportDraft = {
  jobId: string;
  startedAtUtc: string;
  finishedAtUtc: string | null;
  areaHa: string;
  hours: string;
  note: string;
  submittedAtUtc: string | null;
};

export const SECURE_KEYS = {
  terminalSession: 'agriops.terminal.v1',
  terminalReports: 'agriops.terminal.reports.v1',
  soilDraftPrefix: 'agriops.soil.draft.v1.',
  observationDraftPrefix: 'agriops.obs.draft.v1.',
  trackedDraftKeys: 'agriops.draft.index.v1',
  biometricGate: 'agriops.owner.biometric.v1',
} as const;

// Wartość odpowiada SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY (iOS/Android Keystore).
export const SECURE_STORE_OPTIONS = {
  keychainAccessible: 6,
} as const;

export const BIOMETRIC_STORE_OPTIONS = {
  keychainService: 'agriops.biometric.v1',
  keychainAccessible: 6,
  requireAuthentication: true,
  authenticationPrompt: 'Potwierdź tożsamość, aby odblokować sesję AgriOps Mobile',
} as const;

function sanitizeDraftKeyPart(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function soilDraftKey(farmId: string, fieldId: string): string {
  return `${SECURE_KEYS.soilDraftPrefix}${sanitizeDraftKeyPart(farmId)}_${sanitizeDraftKeyPart(fieldId)}`;
}

export function observationDraftKey(farmId: string, fieldCropId: string): string {
  return `${SECURE_KEYS.observationDraftPrefix}${sanitizeDraftKeyPart(farmId)}_${sanitizeDraftKeyPart(fieldCropId)}`;
}

async function trackKey(storage: StorageAdapter, key: string): Promise<void> {
  const raw = await storage.getItemAsync(SECURE_KEYS.trackedDraftKeys, SECURE_STORE_OPTIONS);
  let keys: string[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) keys = parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      keys = [];
    }
  }
  if (!keys.includes(key)) {
    keys.push(key);
    await storage.setItemAsync(SECURE_KEYS.trackedDraftKeys, JSON.stringify(keys), SECURE_STORE_OPTIONS);
  }
}

export async function saveSoilSampleDraft(storage: StorageAdapter, draft: SoilSampleDraft): Promise<void> {
  const key = soilDraftKey(draft.farmId, draft.fieldId);
  await storage.setItemAsync(key, JSON.stringify(draft), SECURE_STORE_OPTIONS);
  await trackKey(storage, key);
}

export async function loadSoilSampleDraft(
  storage: StorageAdapter,
  farmId: string,
  fieldId: string,
): Promise<SoilSampleDraft | null> {
  const raw = await storage.getItemAsync(soilDraftKey(farmId, fieldId), SECURE_STORE_OPTIONS);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SoilSampleDraft;
    if (parsed?.farmId !== farmId || parsed?.fieldId !== fieldId || !Array.isArray(parsed.points)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function deleteSoilSampleDraft(
  storage: StorageAdapter,
  farmId: string,
  fieldId: string,
): Promise<void> {
  await storage.deleteItemAsync(soilDraftKey(farmId, fieldId), SECURE_STORE_OPTIONS);
}

export async function saveObservationDraft(storage: StorageAdapter, draft: ObservationDraft): Promise<void> {
  const key = observationDraftKey(draft.farmId, draft.fieldCropId);
  await storage.setItemAsync(key, JSON.stringify(draft), SECURE_STORE_OPTIONS);
  await trackKey(storage, key);
}

export async function loadObservationDraft(
  storage: StorageAdapter,
  farmId: string,
  fieldCropId: string,
): Promise<ObservationDraft | null> {
  const raw = await storage.getItemAsync(observationDraftKey(farmId, fieldCropId), SECURE_STORE_OPTIONS);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ObservationDraft;
    if (parsed?.farmId !== farmId || parsed?.fieldCropId !== fieldCropId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function deleteObservationDraft(
  storage: StorageAdapter,
  farmId: string,
  fieldCropId: string,
): Promise<void> {
  await storage.deleteItemAsync(observationDraftKey(farmId, fieldCropId), SECURE_STORE_OPTIONS);
}

export async function loadTerminalJobReports(
  storage: StorageAdapter,
): Promise<Record<string, TerminalJobReportDraft>> {
  const raw = await storage.getItemAsync(SECURE_KEYS.terminalReports, SECURE_STORE_OPTIONS);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, TerminalJobReportDraft> : {};
  } catch {
    return {};
  }
}

const MAX_STORED_REPORTS = 10;

export function pruneTerminalReports(
  reports: Record<string, TerminalJobReportDraft>,
  max = MAX_STORED_REPORTS,
): Record<string, TerminalJobReportDraft> {
  const entries = Object.entries(reports).sort(
    ([, a], [, b]) => (b.startedAtUtc ?? '').localeCompare(a.startedAtUtc ?? ''),
  );
  return Object.fromEntries(entries.slice(0, max));
}

export async function saveTerminalJobReports(
  storage: StorageAdapter,
  reports: Record<string, TerminalJobReportDraft>,
): Promise<void> {
  await storage.setItemAsync(
    SECURE_KEYS.terminalReports,
    JSON.stringify(pruneTerminalReports(reports)),
    SECURE_STORE_OPTIONS,
  );
}

export async function clearOwnerLocalData(storage: StorageAdapter): Promise<void> {
  const raw = await storage.getItemAsync(SECURE_KEYS.trackedDraftKeys, SECURE_STORE_OPTIONS);
  if (raw) {
    try {
      const keys = JSON.parse(raw);
      if (Array.isArray(keys)) {
        for (const key of keys) {
          if (typeof key === 'string') {
            await storage.deleteItemAsync(key, SECURE_STORE_OPTIONS);
          }
        }
      }
    } catch {
      // Kontynuuj czyszczenie pozostałych kluczy.
    }
  }
  await storage.deleteItemAsync(SECURE_KEYS.trackedDraftKeys, SECURE_STORE_OPTIONS);
  await storage.deleteItemAsync(SECURE_KEYS.biometricGate, { keychainService: BIOMETRIC_STORE_OPTIONS.keychainService });
}
