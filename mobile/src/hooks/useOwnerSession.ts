import { useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { config } from '../config';
import { AgriOpsApi, ApiError, normalizeApiUrl, type Farm, type Field } from '../services/agriOpsApi';
import {
  BIOMETRIC_STORE_OPTIONS,
  clearOwnerLocalData,
  SECURE_KEYS,
} from '../services/secureDrafts';

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Nie udało się połączyć z serwerem.';

export function useOwnerSession() {
  const [api, setApi] = useState<AgriOpsApi | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [locked, setLocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    try {
      setBiometricAvailable(Boolean(SecureStore.canUseBiometricAuthentication()));
    } catch {
      setBiometricAvailable(false);
    }
    return () => { mounted.current = false; };
  }, []);

  async function login(email: string, password: string) {
    setBusy(true);
    setError('');
    try {
      const client = new AgriOpsApi(
        normalizeApiUrl(config.apiUrl, __DEV__),
        normalizeApiUrl(config.appOrigin, __DEV__),
      );
      await client.login(email, password);
      const result = await client.farms();
      if (mounted.current) {
        setApi(client);
        setLocked(false);
        setFarms(result);
        if (result.length === 1) await readFields(client, result[0]);
      }
    } catch (error) {
      if (mounted.current) setError(errorMessage(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function loadFields(farm: Farm) {
    if (!api) return;
    setBusy(true);
    setError('');
    try { await readFields(api, farm); }
    finally { if (mounted.current) setBusy(false); }
  }

  async function readFields(client: AgriOpsApi, farm: Farm) {
    if (!mounted.current) return;
    setFields([]);
    setSelectedFarm(farm);
    try {
      const result = await client.fields(farm.farmId);
      if (mounted.current) setFields(result);
    } catch (error) {
      if (mounted.current) {
        if (error instanceof ApiError && error.status === 401) clearSession();
        setError(errorMessage(error));
      }
    }
  }

  function changeFarm() {
    setSelectedFarm(null);
    setFields([]);
    setError('');
  }

  function clearSession() {
    setApi(null);
    setLocked(false);
    setFarms([]);
    changeFarm();
    void clearOwnerLocalData(SecureStore).catch(() => {});
  }

  async function lockSession() {
    if (!api) return;
    setError('');
    if (!biometricAvailable) {
      setError('Biometria nie jest skonfigurowana na tym urządzeniu. Użyj wylogowania, aby zamknąć sesję.');
      return;
    }
    try {
      await SecureStore.setItemAsync(
        SECURE_KEYS.biometricGate,
        new Date().toISOString(),
        BIOMETRIC_STORE_OPTIONS,
      );
      if (mounted.current) setLocked(true);
    } catch {
      if (mounted.current) {
        setError('Nie udało się włączyć blokady biometrycznej. Sprawdź blokadę ekranu w ustawieniach Androida.');
      }
    }
  }

  async function unlockWithBiometrics() {
    setError('');
    try {
      const unlocked = await SecureStore.getItemAsync(
        SECURE_KEYS.biometricGate,
        BIOMETRIC_STORE_OPTIONS,
      );
      if (unlocked && mounted.current) {
        setLocked(false);
      } else if (mounted.current) {
        setError('Klucz biometryczny wygasł. Zaloguj się ponownie hasłem.');
      }
    } catch {
      if (mounted.current) {
        setError('Odblokowanie biometrią zostało przerwane lub odrzucone. Spróbuj ponownie albo wyloguj się.');
      }
    }
  }

  async function logout() {
    if (!api) return;
    setBusy(true);
    setError('');
    try {
      await api.logout();
    } catch (error) {
      if (mounted.current) setError(errorMessage(error));
    } finally {
      if (mounted.current) {
        clearSession();
        setBusy(false);
      }
    }
  }

  return {
    api,
    authenticated: api !== null,
    locked,
    biometricAvailable,
    farms, selectedFarm, fields, busy, error,
    login, loadFields, changeFarm, lockSession, unlockWithBiometrics, logout,
  };
}
