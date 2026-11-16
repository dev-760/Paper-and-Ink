/**
 * Extractable "Paper & Ink" Design System Tokens
 * Shared across the Notes, Reader, and News application family.
 */

export type ShelfTone = 'terracotta' | 'sage' | 'navy' | 'tan';
export type ReaderTheme = 'paper' | 'sepia' | 'dark';

export const PAPER_AND_INK_TOKENS = {
  colors: {
    paper: '#F6EFE4',
    paperElevated: '#FBF7F0',
    paperMuted: '#ECE3D4',
    sepia: '#ECE0CB',
    deskDark: '#141A16',
    deskElevated: '#1B231E',
    ink: '#1F2A3A',
    inkMuted: '#525E6E',
    inkOnDark: '#ECE7DC',
    terracotta: '#C4572F',
    sage: '#526B59',
    tan: '#9D7B52',
  },
  acrylicShelves: {
    terracotta: {
      label: 'Terracotta',
      className: 'pi-acrylic-terracotta',
      solidBackingClass: 'bg-[#F6EFE4] text-[#1F2A3A]',
    },
    sage: {
      label: 'Sage',
      className: 'pi-acrylic-sage',
      solidBackingClass: 'bg-[#F6EFE4] text-[#1F2A3A]',
    },
    navy: {
      label: 'Navy',
      className: 'pi-acrylic-navy',
      solidBackingClass: 'bg-[#F6EFE4] text-[#1F2A3A]',
    },
    tan: {
      label: 'Tan',
      className: 'pi-acrylic-tan',
      solidBackingClass: 'bg-[#F6EFE4] text-[#1F2A3A]',
    },
  },
  radii: {
    card: 24,
    cover: 12,
    pill: 9999,
  },
  typography: {
    headlineFamily: '"Fraunces", Georgia, serif',
    readingSerifFamily: '"Source Serif 4", Georgia, serif',
    readingAltFamily: '"Lora", Georgia, serif',
    uiFamily: '"Figtree", sans-serif',
  },
  touchTargetMinPx: 44,
} as const;
