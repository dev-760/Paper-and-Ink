export type NotebookCategory = string;

export type ShelfFilter = 'All' | NotebookCategory;

export type CoverColor =
  | 'navy'
  | 'terracotta'
  | 'sage'
  | 'tan'
  | 'plum'
  | 'forest';

export interface Notebook {
  id: string;
  title: string;
  subtitle?: string;
  category: NotebookCategory;
  coverColor: CoverColor;
  createdAt: string;
  updatedAt: string;
  pageIds: string[];
}

export interface CoverPaletteMeta {
  id: CoverColor;
  label: string;
  bgVar: string;
  inkVar: string;
  mutedVar: string;
  spineVar: string;
  swatchHex: string;
  contrastNote: string;
}

export const COVER_PALETTE: Record<CoverColor, CoverPaletteMeta> = {
  navy: {
    id: 'navy',
    label: 'Ink Navy',
    bgVar: 'var(--pi-cover-navy)',
    inkVar: 'var(--pi-cover-navy-ink)',
    mutedVar: 'var(--pi-cover-navy-muted)',
    spineVar: 'var(--pi-cover-navy-spine)',
    swatchHex: '#1F2A3A',
    contrastNote: 'Cream ink on Navy (12.5:1)',
  },
  terracotta: {
    id: 'terracotta',
    label: 'Terracotta',
    bgVar: 'var(--pi-cover-terracotta)',
    inkVar: 'var(--pi-cover-terracotta-ink)',
    mutedVar: 'var(--pi-cover-terracotta-muted)',
    spineVar: 'var(--pi-cover-terracotta-spine)',
    swatchHex: '#B04A25',
    contrastNote: 'Paper white ink on Terracotta (5.15:1)',
  },
  sage: {
    id: 'sage',
    label: 'Sage Linen',
    bgVar: 'var(--pi-cover-sage)',
    inkVar: 'var(--pi-cover-sage-ink)',
    mutedVar: 'var(--pi-cover-sage-muted)',
    spineVar: 'var(--pi-cover-sage-spine)',
    swatchHex: '#A9B28D',
    contrastNote: 'Ink Navy on Sage (6.59:1)',
  },
  tan: {
    id: 'tan',
    label: 'Archival Tan',
    bgVar: 'var(--pi-cover-tan)',
    inkVar: 'var(--pi-cover-tan-ink)',
    mutedVar: 'var(--pi-cover-tan-muted)',
    spineVar: 'var(--pi-cover-tan-spine)',
    swatchHex: '#D3BF9C',
    contrastNote: 'Ink Navy on Tan (8.05:1)',
  },
  plum: {
    id: 'plum',
    label: 'Dusk Plum',
    bgVar: 'var(--pi-cover-plum)',
    inkVar: 'var(--pi-cover-plum-ink)',
    mutedVar: 'var(--pi-cover-plum-muted)',
    spineVar: 'var(--pi-cover-plum-spine)',
    swatchHex: '#5B4A6E',
    contrastNote: 'Paper white ink on Plum (7.18:1)',
  },
  forest: {
    id: 'forest',
    label: 'Deep Forest',
    bgVar: 'var(--pi-cover-forest)',
    inkVar: 'var(--pi-cover-forest-ink)',
    mutedVar: 'var(--pi-cover-forest-muted)',
    spineVar: 'var(--pi-cover-forest-spine)',
    swatchHex: '#3F4B3A',
    contrastNote: 'Paper white ink on Forest (8.34:1)',
  },
};

export const NOTEBOOK_CATEGORIES: NotebookCategory[] = [
  'School',
  'Personal',
  'Work',
  'Ideas',
  'Projects',
];

export const SHELF_FILTERS: ShelfFilter[] = ['All', ...NOTEBOOK_CATEGORIES];
