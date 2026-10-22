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

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request(route: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${this.baseUrl}${route}`, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'include',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

      if (response.status === 401) {
        throw new ApiError(401, 'Zaloguj się ponownie. Dane logowania mogą być nieprawidłowe lub sesja wygasła.');
      }
      if (response.status === 403) {
        throw new ApiError(403, 'To konto nie ma dostępu do wybranych danych.');
      }
      if (!response.ok) {
        throw new ApiError(response.status, `API nie wykonało żądania (HTTP ${response.status}). Spróbuj ponownie.`);
      }
      if (response.status === 204) return null;
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('API nie odpowiedziało w ciągu 15 sekund.');
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
      };
    });
  }
}
