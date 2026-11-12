import { config } from '../config.ts';

export type PairingPreview = { farmName: string; machineName: string; expiresAt: string };
type TerminalJob = { id: string; type: string; date: string; startTime: string | null; isAllDay: boolean };
export type TerminalDashboard = { farmName: string; machineName: string; jobs: TerminalJob[] };
export type TerminalClaim = { code: string; secret: string };

export class TerminalApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(status === 410 ? 'Kod jest niedostępny. Poproś o nowy kod QR.'
      : status === 429 ? 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.'
        : 'Nie udało się połączyć z AgriOps.');
    this.status = status;
  }
}

export function pairingCodeFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const link = new URL(url);
    const expected = new URL(config.appOrigin);
    const code = link.hash.slice(1);
    return link.protocol === 'https:' && link.origin === expected.origin && link.pathname === '/terminal/pair'
      && !link.username && !link.password && !link.search && /^[A-Za-z0-9_-]{43}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

async function request(path: string, options: RequestInit): Promise<Response> {
  const base = new URL(config.apiUrl);
  if (base.protocol !== 'https:' || base.username || base.password) {
    throw new Error('Parowanie wymaga adresu API HTTPS.');
  }
  const response = await fetch(new URL(`/api/terminal/${path}`, base).href, {
    ...options, credentials: 'omit', redirect: 'error',
  });
  if (!response.ok) throw new TerminalApiError(response.status);
  return response;
}

function post(path: string, data: object, signal?: AbortSignal) {
  return request(`pairing/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal,
  });
}

export async function previewPairing(code: string, signal: AbortSignal): Promise<PairingPreview> {
  return (await post('preview', { code }, signal)).json();
}

export async function claimPairing(claim: TerminalClaim, signal?: AbortSignal): Promise<{ confirmationNumber: string }> {
  return (await post('claim', claim, signal)).json();
}

export async function redeemPairing(claim: TerminalClaim, signal: AbortSignal): Promise<{ token: string } | null> {
  const response = await post('redeem', claim, signal);
  return response.status === 204 ? null : response.json();
}

export async function fetchTerminalDashboard(token: string, signal: AbortSignal): Promise<TerminalDashboard> {
  return (await request('dashboard', { headers: { Authorization: `Terminal ${token}` }, signal })).json();
}
