export const colors = {
  bg: '#FBF7F2',
  surface: 'rgba(255,255,255,0.6)',
  border: 'rgba(255,255,255,0.4)',
  text: '#2B2B33',
  textMuted: '#6E6E7A',
  primary: '#7C9CBF', // azul pastel
  danger: '#E3A6A1',
  // Serie categórica para gráficos — pasteles, en orden estable por índice de categoría.
  chartSeries: ['#A7C7E7', '#F7C9C4', '#B8E0C8', '#F6E2B3', '#D3C4E3', '#F3B9C0', '#C4E0DA'],
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 16, lg: 24, pill: 999 } as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const },
  heading: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const, color: colors.textMuted },
} as const;

export const glass = {
  intensity: 30, // expo-blur
  tint: 'light' as const,
};
