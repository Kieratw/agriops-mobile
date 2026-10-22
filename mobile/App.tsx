import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { OwnerScreen } from './src/screens/OwnerScreen';
import { TractorScreen } from './src/screens/TractorScreen';
import { colors } from './src/theme';

type Screen = 'home' | 'owner' | 'tractor';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'home') return false;
      setScreen('home');
      return true;
    });
    return () => subscription.remove();
  }, [screen]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.app}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.brand}>AgriOps <Text style={styles.suffix}>Mobile</Text></Text>
          {screen !== 'home' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wróć do wyboru trybu"
              onPress={() => setScreen('home')}
              style={styles.back}
            >
              <Text style={styles.backText}>← Wstecz</Text>
            </Pressable>
          )}
        </View>
        {screen === 'home' && <HomeScreen onOwner={() => setScreen('owner')} onTractor={() => setScreen('tractor')} />}
        {screen === 'owner' && <OwnerScreen />}
        {screen === 'tractor' && <TractorScreen />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  brand: { fontWeight: '800', fontSize: 25, color: colors.text },
  suffix: { fontWeight: '400', color: colors.muted, fontSize: 17 },
  back: { minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
});
