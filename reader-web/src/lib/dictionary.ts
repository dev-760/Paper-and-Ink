/**
 * Dictionary lookup abstraction (Phase 2: backed by Free Dictionary API or swappable provider).
 */

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  partOfSpeech: string;
  definition: string;
  example?: string;
}

export interface DictionaryProvider {
  lookup(word: string): Promise<DictionaryEntry | null>;
}

const DICTIONARY_API_BASE = (
  import.meta.env.VITE_DICTIONARY_API_URL || 'https://api.dictionaryapi.dev/api/v2/entries/en'
).replace(/\/+$/, '');

export const freeDictionaryProvider: DictionaryProvider = {
  async lookup(rawWord: string): Promise<DictionaryEntry | null> {
    const clean = rawWord.trim().toLowerCase().replace(/[^a-z'-]/g, '');
    if (!clean) return null;

    try {
      const response = await fetch(`${DICTIONARY_API_BASE}/${encodeURIComponent(clean)}`);
      if (!response.ok) return null;

    const data = (await response.json()) as Array<{
      word: string;
      phonetic?: string;
      meanings?: Array<{
        partOfSpeech?: string;
        definitions?: Array<{
          definition?: string;
          example?: string;
        }>;
      }>;
    }>;

    const first = data[0];
    const meaning = first?.meanings?.[0];
    const def = meaning?.definitions?.[0];
    if (!first || !def?.definition) return null;

      return {
        word: first.word,
        phonetic: first.phonetic,
        partOfSpeech: meaning?.partOfSpeech ?? 'noun',
        definition: def.definition,
        example: def.example,
      };
    } catch {
      return null;
    }
  },
};
