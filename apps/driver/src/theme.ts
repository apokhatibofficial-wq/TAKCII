// Brand identity — same values as packages/shared/src/tokens.ts. React Native
// has no CSS custom properties, so this is the RN-side mirror.
export const COLORS = {
  black: '#181619',
  yellow: '#fde403',
  cream: '#f4efe1',
  white: '#fff',
  green: '#008637',
  danger: '#b3261e',
  textMuted: '#575757'
};

// Tajawal, loaded via @expo-google-fonts/tajawal (App.tsx's useFonts call).
// Each weight is its own font file/family name, not a single variable font —
// pair a family here with fontWeight: 'normal' in styles (never a numeric
// fontWeight alongside it) so Android doesn't go looking for a synthetic
// bold variant of an already-bold file.
export const FONT = {
  regular: 'Tajawal_400Regular',
  medium: 'Tajawal_500Medium',
  bold: 'Tajawal_700Bold',
  extraBold: 'Tajawal_800ExtraBold',
  heavy: 'Tajawal_900Black'
};
