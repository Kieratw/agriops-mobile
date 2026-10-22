import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

type ButtonProps = { title: string; onPress: () => void; disabled?: boolean };

export function Button({ title, onPress, disabled = false }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.dimmed]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function TextButton({ title, onPress, disabled = false }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, (pressed || disabled) && styles.dimmed]}
    >
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

export function Input({ label, ...props }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return <Text accessibilityRole="alert" selectable style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: '600' },
  dimmed: { opacity: 0.5 },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  inputGroup: { marginBottom: 20 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
    color: colors.text,
    fontSize: 16,
  },
  error: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.errorBackground,
    color: colors.error,
    fontSize: 14,
    lineHeight: 21,
  },
});
