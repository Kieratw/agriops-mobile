import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorMessage, Input, TextButton } from '../components/ui';
import { config } from '../config';
import { useOwnerSession } from '../hooks/useOwnerSession';
import { colors, layout } from '../theme';

const number = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });

export function OwnerScreen() {
  const session = useOwnerSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const canLogin = !!config.apiUrl && !!email.trim() && !!password && !session.busy;

  async function signIn() {
    if (!canLogin) return;
    await session.login(email, password);
    setPassword('');
  }

  return (
    <KeyboardAvoidingView style={layout.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={layout.content} keyboardShouldPersistTaps="handled">
        {!session.authenticated ? (
          <>
            <Text style={[layout.title, styles.loginTitle]}>Zaloguj się</Text>
            <Input
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              editable={!session.busy}
            />
            <Input
              label="Hasło"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={signIn}
              editable={!session.busy}
            />
            <Button title={session.busy ? 'Logowanie…' : 'Zaloguj'} onPress={signIn} disabled={!canLogin} />
            {!config.apiUrl && <ErrorMessage message="Brak adresu serwera w konfiguracji aplikacji." />}
          </>
        ) : !session.selectedFarm ? (
          <>
            <View style={layout.heading}>
              <Text style={[layout.title, layout.fill]}>Gospodarstwa</Text>
              <TextButton title="Wyloguj" onPress={session.logout} disabled={session.busy} />
            </View>
            {session.farms.map(farm => (
              <Pressable
                accessibilityRole="button"
                key={farm.farmId}
                onPress={() => session.loadFields(farm)}
                disabled={session.busy}
                style={({ pressed }) => [layout.row, pressed && { opacity: 0.55 }]}
              >
                <Text style={layout.rowTitle}>{farm.name}</Text>
                <Text style={layout.arrow}>→</Text>
              </Pressable>
            ))}
            {!session.farms.length && <Text style={layout.detail}>Brak gospodarstw.</Text>}
          </>
        ) : (
          <>
            <View style={layout.heading}>
              <View style={layout.fill}>
                <Text style={layout.title}>Pola</Text>
                <Text style={layout.subtitle}>{session.selectedFarm.name}</Text>
              </View>
              <TextButton title="Odśwież" onPress={() => session.loadFields(session.selectedFarm!)} disabled={session.busy} />
            </View>
            <Text style={styles.summary}>
              {session.fields.length} pól · {number.format(session.fields.reduce((sum, field) => sum + field.powierzchnia, 0))} ha
            </Text>
            {session.fields.map(field => (
              <View key={field.fieldId} style={layout.row}>
                <View style={layout.fill}>
                  <Text style={layout.rowTitle}>{field.nazwa}</Text>
                  <Text style={layout.detail}>{[field.nr, field.roslina].filter(Boolean).join(' · ') || 'Brak uprawy'}</Text>
                </View>
                <Text style={styles.area}>{number.format(field.powierzchnia)} ha</Text>
              </View>
            ))}
            {!session.busy && !session.error && !session.fields.length && <Text style={layout.detail}>Brak aktywnych pól.</Text>}
            <View style={layout.toolbar}>
              <TextButton title="Gospodarstwa" onPress={session.changeFarm} disabled={session.busy} />
              <TextButton title="Wyloguj" onPress={session.logout} disabled={session.busy} />
            </View>
          </>
        )}
        {session.busy && <ActivityIndicator accessibilityLabel="Pobieranie danych" color={colors.accent} style={styles.loading} />}
        <ErrorMessage message={session.error} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loginTitle: { marginBottom: 32 },
  summary: { color: colors.muted, fontSize: 14, marginBottom: 8 },
  area: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  loading: { marginTop: 24 },
});
