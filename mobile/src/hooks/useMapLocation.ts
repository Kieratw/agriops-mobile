import { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Location from 'expo-location';

type Status = 'idle' | 'searching' | 'ready' | 'denied' | 'blocked' | 'unavailable';

export function useMapLocation() {
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [status, setStatus] = useState<Status>('idle');
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setForeground(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setCoords(null);
    if (!foreground) return;
    let current = true;
    let watch: Location.LocationSubscription | undefined;

    function unavailable() {
      if (!current) return;
      setCoords(null);
      setStatus('unavailable');
    }

    async function start() {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!current) return;
      if (!permission.granted) {
        setStatus(permission.canAskAgain ? 'idle' : 'blocked');
        return;
      }
      setStatus('searching');
      if (!await Location.hasServicesEnabledAsync()) {
        unavailable();
        return;
      }
      if (!current) return;
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 2 },
        ({ coords }) => {
          if (!current || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return;
          setCoords(coords);
          setStatus('ready');
        },
        unavailable,
      );
      if (current) watch = subscription;
      else subscription.remove();
    }

    void start().catch(unavailable);
    return () => {
      current = false;
      watch?.remove();
    };
  }, [foreground, attempt]);

  async function enable() {
    try {
      if (status === 'blocked') {
        await Linking.openSettings();
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) setAttempt(value => value + 1);
      else setStatus(permission.canAskAgain ? 'denied' : 'blocked');
    } catch {
      setStatus('unavailable');
    }
  }

  return { coords: foreground ? coords : null, status, enable };
}
