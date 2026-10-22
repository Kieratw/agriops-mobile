import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ErrorMessage, TextButton } from '../components/ui';
import { mapHtml } from '../map/mapHtml';
import { layout } from '../theme';

export function TractorScreen() {
  const [reload, setReload] = useState(0);
  const [error, setError] = useState(false);

  function refresh() {
    setError(false);
    setReload(value => value + 1);
  }

  return (
    <View style={layout.fill}>
      <View style={styles.heading}>
        <Text style={layout.title}>Mapa</Text>
        <TextButton title="Odśwież" onPress={refresh} />
      </View>
      <WebView
        key={reload}
        style={layout.fill}
        source={{ html: mapHtml, baseUrl: 'https://map.agriops.invalid/' }}
        javaScriptEnabled
        domStorageEnabled={false}
        incognito
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        allowsInlineMediaPlayback={false}
        allowFileAccess={false}
        geolocationEnabled={false}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url === 'https://map.agriops.invalid/'}
        onError={() => setError(true)}
        onHttpError={() => setError(true)}
      />
      {error && <View style={styles.error}><ErrorMessage message="Nie udało się wczytać mapy. Spróbuj odświeżyć." /></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  error: { paddingHorizontal: 16, paddingBottom: 16 },
});
