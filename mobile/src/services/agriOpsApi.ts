import { parseFieldGeometry, type FieldGeometry } from '../map/geometry.ts';

export type Farm = {
  farmId: string;
  name: string;
};

export type Field = {
  fieldId: string;
  farmId: string;
  nazwa: string;
  nr: string;
  powierzchnia: number;
  roslina: string | null;
  geometry: FieldGeometry | null;
};

export type FieldCrop = {
  farmId: string;
  fieldId: string;
  fieldCropId: string;
  activeFrom: string;
  cropName: string | null;
};

export type FieldObservationPhoto = {
  photoId: string;
  originalFileName: string;
  mimeType: string;
};

export type FieldObservation = {
  observationId: string;
  observedAtUtc: string;
  note: string | null;
  photoCount: number;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyMeters?: number | null;
  isWithinField?: boolean | null;
  photos?: FieldObservationPhoto[];
};

export type ObservationPhoto = { uri: string; name: string; type: string };
export type ObservationLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source?: 'gps' | 'manual';
};

export type SoilSamplePointItem = {
  soilSamplePointId: string;
  fieldId: string;
  fieldName: string;
  sampleLabel: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters: number | null;
  depthCmFrom: number | null;
  depthCmTo: number | null;
  soilType: string | null;
  notes: string | null;
  ph: number | null;
  p2O5MgPer100g: number | null;
  k2OMgPer100g: number | null;
  mgMgPer100g: number | null;
};

export type SoilTestSummary = {
  soilTestId: string;
  farmId: string;
  sampleDate: string;
  labName: string | null;
  sourceType: string;
  status: string;
  samplePointCount: number;
  averagePh: number | null;
  averageP2O5MgPer100g: number | null;
  averageK2OMgPer100g: number | null;
  averageMgMgPer100g: number | null;
  notes: string | null;
};

export type SoilTestDetail = SoilTestSummary & {
  samplePoints: SoilSamplePointItem[];
};

export type SaveSoilSamplePointInput = {
  fieldId: string;
  sampleLabel: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters?: number | null;
  depthCmFrom?: number | null;
  depthCmTo?: number | null;
  soilType?: string | null;
  notes?: string | null;
  measuredAt?: string | null;
  ph?: number | null;
  p2O5MgPer100g?: number | null;
  k2OMgPer100g?: number | null;
  mgMgPer100g?: number | null;
};

export type CreateSoilTestInput = {
  sampleDate: string;
  labName?: string | null;
  status?: 'DRAFT' | 'COMPLETED';
  notes?: string | null;
  samplePoints: SaveSoilSamplePointInput[];
};

export type MachineItem = {
  machineId: string;
  farmId: string;
  name: string;
  type: string;
  isActive: boolean;
};

export type FieldOperationItem = {
  fieldOperationId: string;
  farmId: string;
  operationDate: string;
  startTime: string | null;
  endTime: string | null;
  operationType: string;
  status: string;
  isAllDay: boolean;
  notes: string | null;
  fieldNames: string[];
  machineNames: string[];
  totalAreaHa: number;
};

export type CreateSoilCultivationJobInput = {
  fieldId: string;
  areaHa?: number | null;
  operationDate: string;
  startTime?: string | null;
  isAllDay: boolean;
  tractorMachineId: string;
  implementMachineId?: string | null;
  notes?: string | null;
};

export type OwnerPairingStart = {
  pairingId: string;
  code: string;
  expiresAt: string;
};

export type OwnerPairingStatus = {
  state: 'open' | 'claimed' | 'closed' | 'approved';
  confirmationNumber: string | null;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function normalizeApiUrl(input: string, development: boolean): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Niepoprawny adres serwera w konfiguracji aplikacji.');
  }

  const local = ['10.0.2.2', 'localhost', '127.0.0.1'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Adres serwera nie może zawierać ścieżki, hasła ani parametrów.');
  }
  if (url.protocol !== 'https:' && !(development && local && url.protocol === 'http:')) {
    throw new Error('API musi korzystać z HTTPS. HTTP jest dozwolone tylko lokalnie podczas tworzenia aplikacji.');
  }
  return url.origin;
}

export class AgriOpsApi {
  readonly baseUrl: string;
  readonly appOrigin: string | undefined;

  constructor(baseUrl: string, appOrigin?: string) {
    this.baseUrl = baseUrl;
    this.appOrigin = appOrigin;
  }

  private async request(route: string, body?: unknown, methodOverride?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'): Promise<unknown> {
    const controller = new AbortController();
    const multipart = body instanceof FormData;
    const timeoutSeconds = multipart ? 60 : 15;
    const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    const method = methodOverride ?? (body === undefined ? 'GET' : 'POST');

    try {
      const response = await fetch(`${this.baseUrl}${route}`, {
        method,
        credentials: 'include',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }),
          ...(method !== 'GET' && this.appOrigin ? { Origin: this.appOrigin } : {}),
        },
        ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
      });

      if (response.status === 401) {
        throw new ApiError(401, 'Zaloguj się ponownie. Dane logowania mogą być nieprawidłowe lub sesja wygasła.');
      }
      if (response.status === 403) {
        throw new ApiError(403, 'To konto nie ma dostępu do wybranych danych.');
      }
      if (multipart && response.status === 413) {
        throw new ApiError(413, 'Zdjęcie jest za duże lub gospodarstwo nie ma wolnego miejsca.');
      }
      if (multipart && response.status === 400) {
        throw new ApiError(400, 'Serwer odrzucił dane obserwacji. Wybierz inne zdjęcie i spróbuj ponownie.');
      }
      if (!response.ok) {
        let serverMessage: string | null = null;
        try {
          const payload = await response.json();
          if (record(payload) && typeof payload.message === 'string' && payload.message.trim()) {
            serverMessage = payload.message.trim();
          }
        } catch {
          // Brak szczegółowego komunikatu JSON.
        }
        throw new ApiError(
          response.status,
          serverMessage ?? `API nie wykonało żądania (HTTP ${response.status}). Spróbuj ponownie.`,
        );
      }
      if (response.status === 204) return null;
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`API nie odpowiedziało w ciągu ${timeoutSeconds} sekund.`);
      }
      if (error instanceof TypeError) {
        throw new Error('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async login(email: string, password: string): Promise<void> {
    await this.request('/api/auth/login', { email: email.trim(), password });
  }

  async logout(): Promise<void> {
    await this.request('/api/auth/logout', {});
  }

  async farms(): Promise<Farm[]> {
    const values = await this.request('/api/farms');
    if (!Array.isArray(values)) {
      throw new Error('API zwróciło niepoprawną listę gospodarstw.');
    }
    return values.map(value => {
      if (!record(value) || typeof value.farmId !== 'string' || !guid.test(value.farmId)) {
        throw new Error('Niepoprawne dane gospodarstwa.');
      }
      return {
        farmId: value.farmId,
        name: typeof value.name === 'string' ? value.name : value.farmId,
      };
    });
  }

  async fields(farmId: string): Promise<Field[]> {
    if (!guid.test(farmId)) {
      throw new Error('Niepoprawny identyfikator gospodarstwa.');
    }
    const values = await this.request(`/api/farms/${farmId}/fields?includeInactive=false`);
    if (!Array.isArray(values)) {
      throw new Error('API zwróciło niepoprawną listę pól.');
    }
    return values.map(value => {
      if (
        !record(value) ||
        typeof value.fieldId !== 'string' || !guid.test(value.fieldId) ||
        typeof value.farmId !== 'string' || value.farmId.toLowerCase() !== farmId.toLowerCase() ||
        typeof value.nazwa !== 'string' ||
        typeof value.powierzchnia !== 'number' || !Number.isFinite(value.powierzchnia)
      ) {
        throw new Error('API zwróciło niepoprawne dane pola.');
      }
      return {
        fieldId: value.fieldId,
        farmId: value.farmId,
        nazwa: value.nazwa,
        nr: typeof value.nr === 'string' ? value.nr : '',
        powierzchnia: value.powierzchnia,
        roslina: typeof value.roslina === 'string' ? value.roslina : null,
        geometry: parseFieldGeometry(value.geomJson),
      };
    });
  }

  async fieldCrops(field: Field): Promise<FieldCrop[]> {
    if (!guid.test(field.farmId) || !guid.test(field.fieldId)) {
      throw new Error('Niepoprawny identyfikator gospodarstwa lub pola.');
    }
    const values = await this.request(`/api/farms/${field.farmId}/field-cards?mode=open&includeInactive=false`);
    if (!Array.isArray(values)) throw new Error('API zwróciło niepoprawną listę upraw.');
    return values.flatMap(value => {
      if (!record(value) || !sameId(value.farmId, field.farmId) || !validId(value.fieldId)) {
        throw new Error('API zwróciło niepoprawne dane uprawy.');
      }
      if (!sameId(value.fieldId, field.fieldId)) return [];
      if (!validId(value.fieldCropId) || typeof value.activeFrom !== 'string') {
        throw new Error('API zwróciło niepoprawne dane uprawy.');
      }
      return [{
        farmId: field.farmId,
        fieldId: field.fieldId,
        fieldCropId: value.fieldCropId,
        activeFrom: value.activeFrom,
        cropName: typeof value.cropName === 'string' ? value.cropName : null,
      }];
    });
  }

  async observations(crop: FieldCrop): Promise<FieldObservation[]> {
    const result = await this.request(`${observationRoute(crop)}?page=1&pageSize=30`);
    if (!record(result) || !Array.isArray(result.items)) {
      throw new Error('API zwróciło niepoprawną listę obserwacji.');
    }
    return result.items.map(value => parseObservation(value, crop));
  }

  async createObservation(crop: FieldCrop, note: string, photo: ObservationPhoto, location: ObservationLocation | null) {
    const route = observationRoute(crop);
    const body = new FormData();
    body.append('observedAtUtc', new Date().toISOString());
    if (note.trim()) body.append('note', note.trim());
    // React Native accepts a file descriptor for a local URI in multipart requests.
    body.append('photos', photo as unknown as Blob);
    if (location) {
      body.append('latitude', String(location.latitude));
      body.append('longitude', String(location.longitude));
      if (location.accuracy !== null) body.append('locationAccuracyMeters', String(location.accuracy));
    }
    return parseObservation(await this.request(route, body), crop);
  }

  async observationPhotoDataUri(
    farmId: string,
    observationId: string,
    photoId: string,
    thumbnail = true,
  ): Promise<string> {
    if (![farmId, observationId, photoId].every(validId)) {
      throw new Error('Niepoprawny identyfikator gospodarstwa, obserwacji lub zdjęcia.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(
        `${this.baseUrl}/api/farms/${farmId}/observations/${observationId}/photos/${photoId}?thumbnail=${thumbnail ? 'true' : 'false'}`,
        {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
          headers: { Accept: 'image/*' },
        },
      );
      if (response.status === 401) {
        throw new ApiError(401, 'Zaloguj się ponownie. Dane logowania mogą być nieprawidłowe lub sesja wygasła.');
      }
      if (response.status === 403) {
        throw new ApiError(403, 'To konto nie ma dostępu do wybranych danych.');
      }
      if (!response.ok) {
        throw new ApiError(response.status, 'Nie udało się pobrać zdjęcia obserwacji.');
      }
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
      if (!/^image\/(jpeg|png|webp)$/i.test(contentType)) {
        throw new Error('Serwer zwrócił nieobsługiwany format obrazu.');
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > 10_000_000) {
        throw new Error('Niepoprawny rozmiar pobranego zdjęcia.');
      }
      return `data:${contentType.toLowerCase()};base64,${bytesToBase64(bytes)}`;
    } finally {
      clearTimeout(timeout);
    }
  }

  async soilTests(farmId: string, fieldId?: string): Promise<SoilTestSummary[]> {
    if (!validId(farmId) || (fieldId !== undefined && !validId(fieldId))) {
      throw new Error('Niepoprawny identyfikator gospodarstwa lub pola.');
    }
    const query = fieldId ? `?fieldId=${fieldId}` : '';
    const values = await this.request(`/api/farms/${farmId}/soil-tests${query}`);
    if (!Array.isArray(values)) {
      throw new Error('API zwróciło niepoprawną listę prób glebowych.');
    }
    return values.map(value => parseSoilTestSummary(value, farmId));
  }

  async soilTest(farmId: string, soilTestId: string): Promise<SoilTestDetail> {
    if (!validId(farmId) || !validId(soilTestId)) {
      throw new Error('Niepoprawny identyfikator gospodarstwa lub próby glebowej.');
    }
    const value = await this.request(`/api/farms/${farmId}/soil-tests/${soilTestId}`);
    return parseSoilTestDetail(value, farmId);
  }

  async createSoilTest(farmId: string, input: CreateSoilTestInput): Promise<SoilTestDetail> {
    if (!validId(farmId)) {
      throw new Error('Niepoprawny identyfikator gospodarstwa.');
    }
    if (!input.samplePoints.length) {
      throw new Error('Dodaj co najmniej jeden punkt pobrania próbki.');
    }
    for (const point of input.samplePoints) {
      validateSamplePointInput(point);
    }
    const payload = {
      sampleDate: input.sampleDate,
      labName: input.labName?.trim() || null,
      sourceType: 'MANUAL',
      status: input.status ?? 'DRAFT',
      notes: input.notes?.trim() || null,
      samplePoints: input.samplePoints.map(point => ({
        fieldId: point.fieldId,
        sampleLabel: point.sampleLabel.trim(),
        latitude: point.latitude,
        longitude: point.longitude,
        gpsAccuracyMeters: point.gpsAccuracyMeters ?? null,
        depthCmFrom: point.depthCmFrom ?? null,
        depthCmTo: point.depthCmTo ?? null,
        soilType: point.soilType?.trim() || null,
        notes: point.notes?.trim() || null,
        measuredAt: point.measuredAt ?? new Date().toISOString(),
        ph: point.ph ?? null,
        p2O5MgPer100g: point.p2O5MgPer100g ?? null,
        k2OMgPer100g: point.k2OMgPer100g ?? null,
        mgMgPer100g: point.mgMgPer100g ?? null,
      })),
    };
    const value = await this.request(`/api/farms/${farmId}/soil-tests`, payload);
    return parseSoilTestDetail(value, farmId);
  }

  async addSoilSamplePoint(farmId: string, soilTestId: string, point: SaveSoilSamplePointInput): Promise<SoilTestDetail> {
    if (!validId(farmId) || !validId(soilTestId)) {
      throw new Error('Niepoprawny identyfikator gospodarstwa lub próby glebowej.');
    }
    validateSamplePointInput(point);
    const value = await this.request(`/api/farms/${farmId}/soil-tests/${soilTestId}/sample-points`, {
      fieldId: point.fieldId,
      sampleLabel: point.sampleLabel.trim(),
      latitude: point.latitude,
      longitude: point.longitude,
      gpsAccuracyMeters: point.gpsAccuracyMeters ?? null,
      depthCmFrom: point.depthCmFrom ?? null,
      depthCmTo: point.depthCmTo ?? null,
      soilType: point.soilType?.trim() || null,
      notes: point.notes?.trim() || null,
      measuredAt: point.measuredAt ?? new Date().toISOString(),
      ph: point.ph ?? null,
      p2O5MgPer100g: point.p2O5MgPer100g ?? null,
      k2OMgPer100g: point.k2OMgPer100g ?? null,
      mgMgPer100g: point.mgMgPer100g ?? null,
    });
    return parseSoilTestDetail(value, farmId);
  }

  async machines(farmId: string): Promise<MachineItem[]> {
    if (!validId(farmId)) {
      throw new Error('Niepoprawny identyfikator gospodarstwa.');
    }
    const values = await this.request(`/api/farms/${farmId}/machines`);
    if (!Array.isArray(values)) {
      throw new Error('API zwróciło niepoprawną listę maszyn.');
    }
    return values.map(value => {
      if (
        !record(value) ||
        !validId(value.machineId) ||
        !sameId(value.farmId, farmId) ||
        typeof value.name !== 'string' ||
        typeof value.type !== 'string'
      ) {
        throw new Error('API zwróciło niepoprawne dane maszyny.');
      }
      return {
        machineId: value.machineId,
        farmId: value.farmId,
        name: value.name,
        type: value.type,
        isActive: value.isActive !== false,
      };
    });
  }

  async operations(farmId: string, fieldId?: string): Promise<FieldOperationItem[]> {
    if (!validId(farmId) || (fieldId !== undefined && !validId(fieldId))) {
      throw new Error('Niepoprawny identyfikator gospodarstwa lub pola.');
    }
    const query = fieldId ? `?fieldId=${fieldId}` : '';
    const values = await this.request(`/api/farms/${farmId}/documentation${query}`);
    if (!Array.isArray(values)) {
      throw new Error('API zwróciło niepoprawną listę zabiegów.');
    }
    return values.map(value => parseFieldOperation(value, farmId));
  }

  async createSoilCultivationJob(farmId: string, input: CreateSoilCultivationJobInput): Promise<FieldOperationItem> {
    if (!validId(farmId) || !validId(input.fieldId) || !validId(input.tractorMachineId)) {
      throw new Error('Niepoprawny identyfikator gospodarstwa, pola lub ciągnika.');
    }
    if (input.implementMachineId && !validId(input.implementMachineId)) {
      throw new Error('Niepoprawny identyfikator narzędzia.');
    }
    const machines = [
      { machineId: input.tractorMachineId, areaHa: input.areaHa ?? null },
      ...(input.implementMachineId && input.implementMachineId !== input.tractorMachineId
        ? [{ machineId: input.implementMachineId, areaHa: input.areaHa ?? null }]
        : []),
    ];
    const value = await this.request(`/api/farms/${farmId}/documentation`, {
      operationType: 'SOIL_CULTIVATION',
      status: 'PLANNED',
      operationDate: input.operationDate,
      startTime: input.isAllDay ? null : (input.startTime || null),
      isAllDay: input.isAllDay,
      notes: input.notes?.trim() || null,
      fields: [{ fieldId: input.fieldId, areaHa: input.areaHa ?? null, assignmentIntent: 'AUTO' }],
      people: [],
      machines,
      productLines: [],
    });
    return parseFieldOperation(value, farmId);
  }

  async approveOperation(farmId: string, operationId: string): Promise<FieldOperationItem> {
    if (!validId(farmId) || !validId(operationId)) {
      throw new Error('Niepoprawny identyfikator gospodarstwa lub zabiegu.');
    }
    const value = await this.request(
      `/api/farms/${farmId}/documentation/${operationId}/status`,
      { status: 'COMPLETED' },
      'PATCH',
    );
    return parseFieldOperation(value, farmId);
  }

  async startTerminalPairing(farmId: string, machineId: string): Promise<OwnerPairingStart> {
    if (!validId(farmId) || !validId(machineId)) {
      throw new Error('Niepoprawny identyfikator gospodarstwa lub ciągnika.');
    }
    const value = await this.request(`/api/farms/${farmId}/machines/${machineId}/terminal-pairings`, {});
    if (
      !record(value) ||
      !validId(value.pairingId) ||
      typeof value.code !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(value.code) ||
      typeof value.expiresAt !== 'string'
    ) {
      throw new Error('API zwróciło niepoprawne dane parowania.');
    }
    return { pairingId: value.pairingId, code: value.code, expiresAt: value.expiresAt };
  }

  async terminalPairingStatus(farmId: string, machineId: string, pairingId: string): Promise<OwnerPairingStatus> {
    if (![farmId, machineId, pairingId].every(validId)) {
      throw new Error('Niepoprawny identyfikator parowania.');
    }
    const value = await this.request(`/api/farms/${farmId}/machines/${machineId}/terminal-pairings/${pairingId}`);
    if (
      !record(value) ||
      !['open', 'claimed', 'closed', 'approved'].includes(String(value.state))
    ) {
      throw new Error('API zwróciło niepoprawny status parowania.');
    }
    return {
      state: value.state as OwnerPairingStatus['state'],
      confirmationNumber: typeof value.confirmationNumber === 'string' ? value.confirmationNumber : null,
    };
  }

  async approveTerminalPairing(
    farmId: string,
    machineId: string,
    pairingId: string,
    confirmationNumber: string,
  ): Promise<void> {
    if (![farmId, machineId, pairingId].every(validId) || !/^[0-9]{6}$/.test(confirmationNumber.trim())) {
      throw new Error('Niepoprawne dane zatwierdzenia terminala.');
    }
    await this.request(
      `/api/farms/${farmId}/machines/${machineId}/terminal-pairings/${pairingId}/approve`,
      { confirmationNumber: confirmationNumber.trim() },
    );
  }
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && guid.test(value);
}

function sameId(value: unknown, expected: string): value is string {
  return validId(value) && value.toLowerCase() === expected.toLowerCase();
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function observationRoute(crop: FieldCrop): string {
  if (![crop.farmId, crop.fieldId, crop.fieldCropId].every(validId)) {
    throw new Error('Niepoprawny identyfikator gospodarstwa, pola lub uprawy.');
  }
  return `/api/farms/${crop.farmId}/field-crops/${crop.fieldCropId}/observations`;
}

function parseObservation(value: unknown, crop: FieldCrop): FieldObservation {
  if (
    !record(value) ||
    !validId(value.observationId) ||
    !sameId(value.farmId, crop.farmId) ||
    !sameId(value.fieldId, crop.fieldId) ||
    !sameId(value.fieldCropId, crop.fieldCropId) ||
    typeof value.observedAtUtc !== 'string' ||
    !Number.isFinite(Date.parse(value.observedAtUtc)) ||
    !Array.isArray(value.photos)
  ) {
    throw new Error('API zwróciło niepoprawne dane obserwacji.');
  }
  const photos: FieldObservationPhoto[] = value.photos.flatMap(photo => {
    if (!record(photo) || !validId(photo.photoId)) return [];
    return [{
      photoId: photo.photoId,
      originalFileName: typeof photo.originalFileName === 'string' ? photo.originalFileName : 'zdjecie.jpg',
      mimeType: typeof photo.mimeType === 'string' ? photo.mimeType : 'image/jpeg',
    }];
  });
  return {
    observationId: value.observationId,
    observedAtUtc: value.observedAtUtc,
    note: typeof value.note === 'string' ? value.note : null,
    photoCount: value.photos.length,
    latitude: finiteNumberOrNull(value.latitude),
    longitude: finiteNumberOrNull(value.longitude),
    locationAccuracyMeters: finiteNumberOrNull(value.locationAccuracyMeters),
    isWithinField: typeof value.isWithinField === 'boolean' ? value.isWithinField : null,
    photos,
  };
}

function validateSamplePointInput(point: SaveSoilSamplePointInput): void {
  if (!validId(point.fieldId)) {
    throw new Error('Niepoprawny identyfikator pola próbki.');
  }
  if (!point.sampleLabel.trim()) {
    throw new Error('Podaj oznaczenie próbki gleby.');
  }
  if (
    !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
    point.latitude < -90 || point.latitude > 90 ||
    point.longitude < -180 || point.longitude > 180
  ) {
    throw new Error('Niepoprawne współrzędne punktu pobrania próbki.');
  }
  if (point.ph != null && (!Number.isFinite(point.ph) || point.ph < 0 || point.ph > 14)) {
    throw new Error('Odczyn pH musi mieścić się w zakresie 0–14.');
  }
}

function parseSoilTestSummary(value: unknown, expectedFarmId: string): SoilTestSummary {
  if (
    !record(value) ||
    !validId(value.soilTestId) ||
    !sameId(value.farmId, expectedFarmId) ||
    typeof value.sampleDate !== 'string'
  ) {
    throw new Error('API zwróciło niepoprawne dane próby glebowej.');
  }
  return {
    soilTestId: value.soilTestId,
    farmId: value.farmId,
    sampleDate: value.sampleDate,
    labName: typeof value.labName === 'string' ? value.labName : null,
    sourceType: typeof value.sourceType === 'string' ? value.sourceType : 'MANUAL',
    status: typeof value.status === 'string' ? value.status : 'DRAFT',
    samplePointCount: typeof value.samplePointCount === 'number' ? value.samplePointCount : 0,
    averagePh: finiteNumberOrNull(value.averagePh),
    averageP2O5MgPer100g: finiteNumberOrNull(value.averageP2O5MgPer100g),
    averageK2OMgPer100g: finiteNumberOrNull(value.averageK2OMgPer100g),
    averageMgMgPer100g: finiteNumberOrNull(value.averageMgMgPer100g),
    notes: typeof value.notes === 'string' ? value.notes : null,
  };
}

function parseSoilTestDetail(value: unknown, expectedFarmId: string): SoilTestDetail {
  const summary = parseSoilTestSummary(value, expectedFarmId);
  if (!record(value) || !Array.isArray(value.samplePoints)) {
    throw new Error('API zwróciło niepoprawne punkty próby glebowej.');
  }
  const samplePoints: SoilSamplePointItem[] = value.samplePoints.map(item => {
    if (
      !record(item) ||
      !validId(item.soilSamplePointId) ||
      !validId(item.fieldId) ||
      typeof item.sampleLabel !== 'string' ||
      typeof item.latitude !== 'number' || !Number.isFinite(item.latitude) ||
      typeof item.longitude !== 'number' || !Number.isFinite(item.longitude)
    ) {
      throw new Error('API zwróciło niepoprawny punkt próbki glebowej.');
    }
    return {
      soilSamplePointId: item.soilSamplePointId,
      fieldId: item.fieldId,
      fieldName: typeof item.fieldName === 'string' ? item.fieldName : '',
      sampleLabel: item.sampleLabel,
      latitude: item.latitude,
      longitude: item.longitude,
      gpsAccuracyMeters: finiteNumberOrNull(item.gpsAccuracyMeters),
      depthCmFrom: finiteNumberOrNull(item.depthCmFrom),
      depthCmTo: finiteNumberOrNull(item.depthCmTo),
      soilType: typeof item.soilType === 'string' ? item.soilType : null,
      notes: typeof item.notes === 'string' ? item.notes : null,
      ph: finiteNumberOrNull(item.ph),
      p2O5MgPer100g: finiteNumberOrNull(item.p2O5MgPer100g),
      k2OMgPer100g: finiteNumberOrNull(item.k2OMgPer100g),
      mgMgPer100g: finiteNumberOrNull(item.mgMgPer100g),
    };
  });
  return { ...summary, samplePoints };
}

function parseFieldOperation(value: unknown, expectedFarmId: string): FieldOperationItem {
  if (
    !record(value) ||
    !validId(value.fieldOperationId) ||
    !sameId(value.farmId, expectedFarmId) ||
    typeof value.operationDate !== 'string' ||
    typeof value.operationType !== 'string' ||
    typeof value.status !== 'string'
  ) {
    throw new Error('API zwróciło niepoprawne dane zabiegu.');
  }
  const fields = Array.isArray(value.fields) ? value.fields : [];
  const machines = Array.isArray(value.machines) ? value.machines : [];
  let totalAreaHa = 0;
  const fieldNames: string[] = [];
  for (const field of fields) {
    if (record(field)) {
      if (typeof field.fieldName === 'string' && field.fieldName) fieldNames.push(field.fieldName);
      if (typeof field.areaHa === 'number' && Number.isFinite(field.areaHa)) totalAreaHa += field.areaHa;
    }
  }
  const machineNames: string[] = [];
  for (const machine of machines) {
    if (record(machine) && typeof machine.machineName === 'string' && machine.machineName) {
      machineNames.push(machine.machineName);
    }
  }
  return {
    fieldOperationId: value.fieldOperationId,
    farmId: value.farmId,
    operationDate: value.operationDate,
    startTime: typeof value.startTime === 'string' ? value.startTime : null,
    endTime: typeof value.endTime === 'string' ? value.endTime : null,
    operationType: value.operationType,
    status: value.status,
    isAllDay: Boolean(value.isAllDay),
    notes: typeof value.notes === 'string' ? value.notes : null,
    fieldNames,
    machineNames,
    totalAreaHa: Math.round(totalAreaHa * 100) / 100,
  };
}

const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    output += base64Alphabet[(triple >> 18) & 0x3f];
    output += base64Alphabet[(triple >> 12) & 0x3f];
    output += i + 1 < bytes.length ? base64Alphabet[(triple >> 6) & 0x3f] : '=';
    output += i + 2 < bytes.length ? base64Alphabet[triple & 0x3f] : '=';
  }
  return output;
}
