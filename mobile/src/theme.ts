import { StyleSheet } from 'react-native';

export const colors = {
  background: '#f8f9f5',
  surface: '#ffffff',
  text: '#1c3328',
  muted: '#6c786f',
  accent: '#246448',
  line: '#dce3d9',
  error: '#943f32',
  errorBackground: '#f8eae4',
};

export const layout = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 6 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  rowTitle: { color: colors.text, fontSize: 18, fontWeight: '600', flexShrink: 1 },
  detail: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  arrow: { color: colors.accent, fontSize: 24 },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 24,
  },
});
