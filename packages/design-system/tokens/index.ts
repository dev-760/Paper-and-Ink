export const PAPER_INK_SHARED_TOKENS = {
  colors: {
    paperCream: '#F6EFE4',
    paperElevated: '#FBF7F0',
    paperMuted: '#ECE3D4',
    sepia: '#ECE0CB',
    deskDark: '#141A16',
    deskElevated: '#1B231E',
    deskMuted: '#222B25',
    ink: '#1F2A3A',
    inkDarkMode: '#ECE5D8',
    terracotta: '#C4572F',
    terracottaHover: '#AE4823',
    sage: '#526B59',
    tan: '#9D7B52',
    wine: '#7A3229',
    ochre: '#C9963B',
  },
  typography: {
    display: "'Fraunces', Georgia, serif",
    serif: "'Source Serif 4', 'Lora', Georgia, serif",
    sans: "'Figtree', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  radii: {
    sheet: 24,
    card: 16,
    control: 12,
    pill: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
  },
  motion: {
    easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
    fastMs: 150,
    baseMs: 220,
  },
} as const;

export type PaperInkTheme = 'light' | 'dark' | 'sepia';
