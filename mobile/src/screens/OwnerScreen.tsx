import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorMessage, Input, TextButton } from '../components/ui';
import { config } from '../config';
import { useOwnerSession } from '../hooks/useOwnerSession';
import { colors, layout } from '../theme';
import { FieldsMap } from '../map/FieldsMap';
import { FieldDocumentation } from './FieldDocumentation';
import { FieldObservations } from './FieldObservations';
import { FieldSoilSamples } from './FieldSoilSamples';

const number = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });

type Subview =
  | { kind: 'list' }
  | { kind: 'observations'; fieldId: string }
  | { kind: 'soil'; fieldId: string }
  | { kind: 'documentation'; fieldId: string | null };

export function OwnerScreen({ deepLinkFieldId = null }: { deepLinkFieldId?: string | null }) {
  const session = useOwnerSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focus, setFocus] = useState<{ fieldId: string | null }>({ fieldId: null });
  const [subview, setSubview] = useState<Subview>({ kind: 'list' });
  const [deepLinkNotice, setDeepLinkNotice] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const mapTop = useRef(0);

  useEffect(() => {
    setFocus({ fieldId: null });
    setSubview({ kind: 'list' });
    setDeepLinkNotice('');
  }, [session.selectedFarm?.farmId]);

  useEffect(() => {
    if (!deepLinkFieldId || !session.selectedFarm || session.busy || session.fields.length === 0) return;
    const matched = session.fields.find(f => f.fieldId.toLowerCase() === deepLinkFieldId.toLowerCase());
    if (matched) {
      setFocus({ fieldId: matched.fieldId });
      setDeepLinkNotice(`Otwarto pole z linku: ${matched.nazwa}`);
    } else {
      setDeepLinkNotice('Pole wskazane w linku nie należy do wybranego gospodarstwa.');
    }
  }, [deepLinkFieldId, session.busy, session.fields, session.selectedFarm]);

  const canLogin = !!config.apiUrl && !!email.trim() && !!password && !session.busy;

  function focusField(fieldId: string | null) {
    setFocus({ fieldId });
    scroll.current?.scrollTo({ y: Math.max(0, mapTop.current - 12), animated: false });
  }

  async function signIn() {
    if (!canLogin) return;
    await session.login(email, password);
    setPassword('');
  }

  function openSubview(next: Subview) {
    setSubview(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  const activeField = subview.kind === 'observations' || subview.kind === 'soil'
    ? session.fields.find(field => field.fieldId === subview.fieldId)
    : undefined;

  return (
    <KeyboardAvoidingView style={layout.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={layout.content} keyboardShouldPersistTaps="handled">
        {!session.authenticated ? (
          <>
            <Text style={[layout.title, styles.loginTitle]}>Zaloguj się</Text>
            {deepLinkFieldId && (
              <Text style={layout.detail}>Zaloguj się na konto właściciela, aby otworzyć szczegóły pola z linku.</Text>
            )}
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
        ) : session.locked ? (
          <>
            <Text style={[layout.title, styles.loginTitle]}>Sesja zablokowana</Text>
            <Text style={layout.detail}>
              Sesja właściciela jest chroniona blokadą biometryczną / systemową Androida. Odblokuj dostęp albo wyloguj się.
            </Text>
            <Button title="Odblokuj biometrią" onPress={() => void session.unlockWithBiometrics()} disabled={session.busy} />
            <TextButton title="Wyloguj i zaloguj hasłem" onPress={() => void session.logout()} disabled={session.busy} />
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
        ) : session.api && subview.kind === 'observations' && activeField ? (
          <FieldObservations
            key={activeField.fieldId}
            api={session.api}
            field={activeField}
            onBack={() => openSubview({ kind: 'list' })}
          />
        ) : session.api && subview.kind === 'soil' && activeField ? (
          <FieldSoilSamples
            key={activeField.fieldId}
            api={session.api}
            field={activeField}
            onBack={() => openSubview({ kind: 'list' })}
          />
        ) : session.api && subview.kind === 'documentation' ? (
          <FieldDocumentation
            api={session.api}
            farmId={session.selectedFarm.farmId}
            farmName={session.selectedFarm.name}
            fields={session.fields}
            initialFieldId={subview.fieldId}
            onBack={() => openSubview({ kind: 'list' })}
          />
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
            {deepLinkNotice ? <Text style={styles.notice}>{deepLinkNotice}</Text> : null}
            <View style={[layout.toolbar, { marginTop: 0 }]}>
              <TextButton
                title="Dokumentacja i zlecenia"
                onPress={() => openSubview({ kind: 'documentation', fieldId: null })}
                disabled={session.busy}
              />
              <TextButton
                title="Zablokuj biometrią"
                onPress={() => void session.lockSession()}
                disabled={session.busy}
              />
            </View>
            {!session.busy && !session.error && session.fields.length > 0 && (
              <>
                <View onLayout={event => { mapTop.current = event.nativeEvent.layout.y; }}>
                  <FieldsMap fields={session.fields} focus={focus} />
                </View>
                {session.fields.some(field => field.geometry) && (
                  <TextButton title="Pokaż wszystkie pola" onPress={() => focusField(null)} />
                )}
              </>
            )}
            {session.fields.map(field => (
              <View key={field.fieldId}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${field.nazwa}, ${number.format(field.powierzchnia)} ha${field.geometry ? ', pokaż na mapie' : ', brak granic'}`}
                  accessibilityState={{ selected: focus.fieldId === field.fieldId }}
                  disabled={session.busy || !field.geometry}
                  onPress={() => focusField(field.fieldId)}
                  style={({ pressed }) => [layout.row, focus.fieldId === field.fieldId && styles.selected, pressed && { opacity: 0.55 }]}
                >
                  <View style={layout.fill}>
                    <Text style={layout.rowTitle}>{field.nazwa}</Text>
                    <Text style={layout.detail}>{[field.nr, field.roslina].filter(Boolean).join(' · ') || 'Brak uprawy'}</Text>
                    {!field.geometry && <Text style={layout.detail}>Brak granic na mapie</Text>}
                  </View>
                  <Text style={styles.area}>{number.format(field.powierzchnia)} ha</Text>
                </Pressable>
                <View style={styles.fieldActions}>
                  <TextButton
                    title="Zdjęcia i obserwacje"
                    onPress={() => openSubview({ kind: 'observations', fieldId: field.fieldId })}
                    disabled={session.busy}
                  />
                  <TextButton
                    title="Próbki gleby"
                    onPress={() => openSubview({ kind: 'soil', fieldId: field.fieldId })}
                    disabled={session.busy}
                  />
                  <TextButton
                    title="Zlecenia / dokumentacja"
                    onPress={() => openSubview({ kind: 'documentation', fieldId: field.fieldId })}
                    disabled={session.busy}
                  />
                </View>
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
  notice: { color: colors.accent, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  area: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  loading: { marginTop: 24 },
  selected: { backgroundColor: '#eaf1e6', paddingHorizontal: 12, borderRadius: 8 },
  fieldActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 8 },
});
