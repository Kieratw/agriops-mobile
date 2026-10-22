import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, layout } from '../theme';

type Props = { onOwner: () => void; onTractor: () => void };

export function HomeScreen({ onOwner, onTractor }: Props) {
  return (
    <ScrollView contentContainerStyle={[layout.content, styles.content]}>
      <Text style={styles.heading}>Wybierz tryb</Text>
      <Mode title="Właściciel" subtitle="Pola gospodarstwa" onPress={onOwner} />
      <Mode title="Ciągnik" subtitle="Mapa terenu" onPress={onTractor} />
    </ScrollView>
  );
}

function Mode({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [layout.row, styles.mode, pressed && { opacity: 0.55 }]}
    >
      <View style={layout.fill}>
        <Text style={styles.modeTitle}>{title}</Text>
        <Text style={layout.detail}>{subtitle}</Text>
      </View>
      <Text style={layout.arrow}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 40 },
  heading: { color: colors.muted, fontSize: 16, marginBottom: 20 },
  mode: { paddingVertical: 28 },
  modeTitle: { color: colors.text, fontWeight: '700', fontSize: 26 },
});
