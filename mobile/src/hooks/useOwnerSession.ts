import { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { AgriOpsApi, ApiError, normalizeApiUrl, type Farm, type Field } from '../services/agriOpsApi';

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Nie udało się połączyć z serwerem.';

export function useOwnerSession() {
  const [api, setApi] = useState<AgriOpsApi | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function login(email: string, password: string) {
    setBusy(true);
    setError('');
    try {
      const client = new AgriOpsApi(normalizeApiUrl(config.apiUrl, __DEV__));
      await client.login(email, password);
      const result = await client.farms();
      if (mounted.current) {
        setApi(client);
        setFarms(result);
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
    setFields([]);
    setSelectedFarm(farm);
    try {
      const result = await api.fields(farm.farmId);
      if (mounted.current) setFields(result);
    } catch (error) {
      if (mounted.current) {
        if (error instanceof ApiError && error.status === 401) clearSession();
        setError(errorMessage(error));
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function changeFarm() {
    setSelectedFarm(null);
    setFields([]);
    setError('');
  }

  function clearSession() {
    setApi(null);
    setFarms([]);
    changeFarm();
  }

  async function logout() {
    if (!api) return;
    setBusy(true);
    setError('');
    try {
      await api.logout();
      if (mounted.current) clearSession();
    } catch (error) {
      if (mounted.current) setError(errorMessage(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return {
    authenticated: api !== null,
    farms, selectedFarm, fields, busy, error,
    login, loadFields, changeFarm, logout,
  };
}
