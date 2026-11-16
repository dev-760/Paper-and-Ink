import type { Shelf } from '../types/reader';

export const DEFAULT_SHELVES: Shelf[] = [
  {
    id: 'essays-natural-history',
    title: 'Essays & Natural History',
    tone: 'sage',
    description: 'Field notes, quiet observation, and seasonal reflection.',
  },
  {
    id: 'classic-fiction',
    title: 'Classic Fiction',
    tone: 'terracotta',
    description: 'Novels and short prose built for unhurried reading.',
  },
  {
    id: 'philosophy-craft',
    title: 'Philosophy & Craft',
    tone: 'navy',
    description: 'Meditations on attention, architecture, design, and making.',
  },
];
