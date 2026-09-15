// Brand identity — fixed. Do not invent new colors; see apps/rider/src/styles/tokens.css
// for the CSS-custom-property mirror of the same values.
export const COLORS = {
  black: '#181619',
  yellow: '#fde403',
  cream: '#f4efe1',
  white: '#fff',
  green: '#008637'
} as const;

export const FONTS = {
  display: "'FreePalestine', 'Tajawal', sans-serif",
  button: "'Tajawal', sans-serif",
  body: "'IBM Plex Sans Arabic', system-ui, sans-serif"
} as const;

export const CITY_CENTER: [number, number] = [36.201, 36.742];
