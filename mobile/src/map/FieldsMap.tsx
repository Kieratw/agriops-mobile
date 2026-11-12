import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { TextButton } from '../components/ui';
import { useMapLocation } from '../hooks/useMapLocation';
import type { Field } from '../services/agriOpsApi';
import { colors } from '../theme';
import { createMapHtml, type MapMarker } from './mapHtml';

export type MapPoint = { latitude: number; longitude: number };

type Props = {
  fields?: Field[];
  focus?: { fieldId: string | null };
  fullScreen?: boolean;
  markers?: readonly MapMarker[];
  selectedPoint?: MapPoint | null;
  onSelectPoint?: (point: MapPoint) => void;
};

const emptyFields: Field[] = [];
const emptyMarkers: readonly MapMarker[] = [];

export function FieldsMap({
  fields = emptyFields,
  focus,
  fullScreen = false,
  markers = emptyMarkers,
  selectedPoint = null,
  onSelectPoint,
}: Props) {
  const web = useRef<WebView<unknown>>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [follow, setFollow] = useState(!focus);
  const { coords, status, enable } = useMapLocation();
  const selectable = Boolean(onSelectPoint);
  const source = useMemo(() => ({
    html: createMapHtml(fields, markers, selectable), baseUrl: 'https://map.agriops.invalid/',
  }), [fields, markers, selectable]);

  function applyFocus() {
    const id = JSON.stringify(focus?.fieldId ?? null);
    web.current?.injectJavaScript(`if (window.agriOpsFocusField) window.agriOpsFocusField(${id}); true;`);
  }

  function applyLocation() {
    const position = coords && { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy };
    web.current?.injectJavaScript(`if (window.agriOpsLocation) window.agriOpsLocation(${JSON.stringify(position)}, ${follow}); true;`);
  }

  function applySelectedPoint() {
    const point = selectedPoint && { latitude: selectedPoint.latitude, longitude: selectedPoint.longitude };
    web.current?.injectJavaScript(`if (window.agriOpsSelectedPoint) window.agriOpsSelectedPoint(${JSON.stringify(point)}); true;`);
  }

  function handleMessage(event: WebViewMessageEvent) {
    if (!onSelectPoint) return;
    try {
      const payload = JSON.parse(event.nativeEvent.data) as Record<string, unknown>;
      if (
        payload?.type === 'selectPoint' &&
        typeof payload.latitude === 'number' && Number.isFinite(payload.latitude) &&
        typeof payload.longitude === 'number' && Number.isFinite(payload.longitude) &&
        payload.latitude >= -90 && payload.latitude <= 90 &&
        payload.longitude >= -180 && payload.longitude <= 180
      ) {
        onSelectPoint({
          latitude: Number(payload.latitude.toFixed(6)),
          longitude: Number(payload.longitude.toFixed(6)),
        });
      }
    } catch {
      // Ignoruj niepoprawne wiadomości z WebView.
    }
  }

  useEffect(() => {
    if (focus) setFollow(false);
    applyFocus();
  }, [focus, source]);
  useEffect(() => { applyLocation(); }, [coords, follow]);
  useEffect(() => { applySelectedPoint(); }, [selectedPoint, source]);

  const locationMessage = {
    idle: 'Włącz lokalizację, aby zobaczyć swoją pozycję.',
    searching: 'Ustalam pozycję…',
    ready: coords?.accuracy != null ? `Dokładność około ${Math.round(coords.accuracy)} m` : 'Lokalizacja aktywna',
    denied: 'Brak zgody na lokalizację.',
    blocked: 'Zezwól na lokalizację w ustawieniach aplikacji.',
    unavailable: 'Sprawdź, czy lokalizacja w telefonie jest włączona.',
  }[status];

  return (
    <View style={fullScreen ? styles.full : styles.container}>
      <View style={[styles.frame, fullScreen && styles.full]}>
        <WebView<unknown>
          key={reload}
          ref={web}
          source={source}
          style={styles.map}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled={false}
          incognito
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          allowFileAccess={false}
          geolocationEnabled={false}
          setSupportMultipleWindows={false}
          nestedScrollEnabled
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url === 'https://map.agriops.invalid/'}
          onLoadEnd={() => { applyFocus(); applyLocation(); applySelectedPoint(); }}
          onError={() => setError(true)}
          onHttpError={() => setError(true)}
        />
      </View>
      {error && <TextButton title="Wczytaj mapę ponownie" onPress={() => {
        setError(false);
        setReload(value => value + 1);
      }} />}
      <View style={styles.controls}>
        <Text style={[styles.note, styles.full]}>
          {selectable ? 'Dotknij miejsca na polu na mapie, aby zaznaczyć punkt. ' : ''}{locationMessage}
        </Text>
        {status === 'ready' ? (
          <TextButton title={follow ? 'Zatrzymaj centrowanie' : 'Centruj na mnie'} onPress={() => setFollow(value => !value)} />
        ) : status !== 'searching' && (
          <TextButton title={status === 'blocked' ? 'Ustawienia' : status === 'unavailable' ? 'Ponów' : 'Włącz GPS'} onPress={enable} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  full: { flex: 1 },
  frame: { height: 340, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1, backgroundColor: '#e8ebe5' },
  controls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  note: { color: colors.muted, fontSize: 14, lineHeight: 21, paddingVertical: 8 },
});
