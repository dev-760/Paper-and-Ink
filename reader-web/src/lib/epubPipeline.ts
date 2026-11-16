import type { ShelfTone } from '../design-system/tokens';
import type { Book, Chapter, Shelf } from '../types/reader';
import { requestBookBrief } from './bookBrief';
import {
  estimateReadingMinutes,
  parseFilenameTitleAuthor,
  pickDeterministicCover,
  suggestShelf,
} from './bookImportUtils';
import type { ImportStage } from './pdfPipeline';

export interface EpubImportProgress {
  stage: ImportStage;
  currentPage?: number;
  totalPages?: number;
  detail: string;
}

export interface EpubImportResult {
  book: Book;
  suggestedShelfId?: string;
  suggestedTone?: ShelfTone;
  warnings: string[];
}

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const UTF8_DECODER = new TextDecoder('utf-8');

function findZipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65557);

  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error('This EPUB does not contain a valid ZIP archive.');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let pos = view.getUint32(eocdOffset + 16, true);
  const entries = new Map<string, ZipEntry>();

  for (let i = 0; i < totalEntries && pos + 46 <= bytes.length; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) {
      break;
    }

    const compressionMethod = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const fileNameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);

    const name = UTF8_DECODER.decode(bytes.subarray(pos + 46, pos + 46 + fileNameLength));
    entries.set(name, {
      name,
      compressionMethod,
      compressedSize,
      localHeaderOffset,
    });

    pos += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function readZipEntryBytes(
  bytes: Uint8Array,
  entries: Map<string, ZipEntry>,
  targetName: string,
): Promise<Uint8Array | null> {
  const entry =
    entries.get(targetName) ||
    Array.from(entries.values()).find((e) => e.name.toLowerCase() === targetName.toLowerCase());
  if (!entry) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const localOffset = entry.localHeaderOffset;
  if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) {
    return null;
  }

  const localNameLen = view.getUint16(localOffset + 26, true);
  const localExtraLen = view.getUint16(localOffset + 28, true);
  const dataStart = localOffset + 30 + localNameLen + localExtraLen;
  const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressed;
  }

  if (entry.compressionMethod === 8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Browser ZIP deflate decompression is unavailable.');
    }
    const stream = new Blob([new Uint8Array(compressed)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const decompressedBuffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(decompressedBuffer);
  }

  throw new Error(`Unsupported EPUB compression method (${entry.compressionMethod}).`);
}

async function readZipEntryText(
  bytes: Uint8Array,
  entries: Map<string, ZipEntry>,
  targetName: string,
): Promise<string | null> {
  const raw = await readZipEntryBytes(bytes, entries, targetName);
  return raw ? UTF8_DECODER.decode(raw) : null;
}

function resolveRelativePath(baseFilePath: string, href: string): string {
  const cleanHref = href.split('#')[0].split('?')[0];
  let decodedHref = cleanHref;
  try {
    decodedHref = decodeURIComponent(cleanHref);
  } catch {
    decodedHref = cleanHref;
  }

  const baseParts = baseFilePath.split('/').slice(0, -1);
  const relParts = decodedHref.split('/');
  const combined = [...baseParts];

  for (const part of relParts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      combined.pop();
    } else {
      combined.push(part);
    }
  }

  return combined.join('/');
}

function getFirstTextByLocalName(doc: Document | Element, localName: string): string {
  const byTag = doc.getElementsByTagName(localName)[0]?.textContent?.trim();
  if (byTag) return byTag;
  const dcByTag = doc.getElementsByTagName(`dc:${localName}`)[0]?.textContent?.trim();
  if (dcByTag) return dcByTag;
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.localName?.toLowerCase() === localName.toLowerCase()) {
      const value = el.textContent?.trim();
      if (value) return value;
    }
  }
  return '';
}

function parseNcxToc(xmlText: string, ncxPath: string): Map<string, string> {
  const map = new Map<string, string>();
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const navPoints = Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === 'navPoint');
  for (const np of navPoints) {
    const label = getFirstTextByLocalName(np, 'text');
    const contentEl = Array.from(np.getElementsByTagName('*')).find((el) => el.localName === 'content');
    const src = contentEl?.getAttribute('src') || '';
    if (label && src) {
      const resolved = resolveRelativePath(ncxPath, src);
      if (!map.has(resolved)) {
        map.set(resolved, label);
      }
    }
  }
  return map;
}

function parseNavXhtmlToc(htmlText: string, navPath: string): Map<string, string> {
  const map = new Map<string, string>();
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  const links = Array.from(doc.querySelectorAll('nav a[href]'));
  for (const a of links) {
    const href = a.getAttribute('href') || '';
    const label = a.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (href && label) {
      const resolved = resolveRelativePath(navPath, href);
      if (!map.has(resolved)) {
        map.set(resolved, label);
      }
    }
  }
  return map;
}

function extractChapterContentFromHtml(htmlText: string): { heading?: string; paragraphs: string[] } {
  const parser = new DOMParser();
  const isXhtml = /<\/html>/i.test(htmlText) && /xmlns=/i.test(htmlText);
  let doc = parser.parseFromString(htmlText, isXhtml ? 'application/xhtml+xml' : 'text/html');
  if (!doc.body || doc.querySelector('parsererror')) {
    doc = parser.parseFromString(htmlText, 'text/html');
  }

  const root = doc.body || doc.documentElement;
  if (!root) {
    return { paragraphs: [] };
  }

  root.querySelectorAll('script, style, svg, head, nav, [hidden]').forEach((el) => el.remove());

  const headingEl = root.querySelector('h1, h2, h3');
  const heading = headingEl?.textContent?.replace(/\s+/g, ' ').trim() || undefined;

  const paragraphs: string[] = [];
  const blockNodes = root.querySelectorAll('p, blockquote, h2, h3, h4, li');

  for (const node of Array.from(blockNodes)) {
    if (node === headingEl) continue;
    // Skip nested blocks inside li/blockquote that would duplicate text
    if (node.closest('blockquote, li') && node.closest('blockquote, li') !== node) continue;
    const text = node.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (text.length > 0 && text !== heading) {
      paragraphs.push(text);
    }
  }

  if (paragraphs.length === 0) {
    const fallbackBlocks = (root.textContent || '')
      .split(/\n{2,}|\r\n\r\n/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 0 && s !== heading);
    paragraphs.push(...fallbackBlocks);
  }

  return { heading, paragraphs };
}

export async function importEpubBook(
  file: File,
  shelves: Shelf[],
  options: {
    onProgress?: (progress: EpubImportProgress) => void;
  } = {},
): Promise<EpubImportResult> {
  const { onProgress } = options;
  const warnings: string[] = [];

  onProgress?.({ stage: 'extracting', detail: `Unpacking ${file.name} locally…` });
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const entries = findZipEntries(bytes);

  const containerXml = await readZipEntryText(bytes, entries, 'META-INF/container.xml');
  if (!containerXml) {
    throw new Error('Could not find META-INF/container.xml in this EPUB.');
  }

  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
  const rootfileEl = Array.from(containerDoc.getElementsByTagName('*')).find(
    (el) => el.localName === 'rootfile',
  );
  const opfPath = rootfileEl?.getAttribute('full-path');
  if (!opfPath) {
    throw new Error('This EPUB package manifest could not be located.');
  }

  const opfXml = await readZipEntryText(bytes, entries, opfPath);
  if (!opfXml) {
    throw new Error(`Could not read EPUB package file (${opfPath}).`);
  }

  const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');
  const opfTitle = getFirstTextByLocalName(opfDoc, 'title');
  const opfAuthor = getFirstTextByLocalName(opfDoc, 'creator');
  const opfDate = getFirstTextByLocalName(opfDoc, 'date');
  const parsedFilename = parseFilenameTitleAuthor(file.name);

  const title = opfTitle || parsedFilename.title || 'Imported EPUB';
  const author = opfAuthor || parsedFilename.author || 'Unknown Author';
  const yearMatch = opfDate.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

  const manifestMap = new Map<string, { href: string; mediaType: string; properties: string }>();
  let ncxPath: string | null = null;
  let navPath: string | null = null;

  const manifestItems = Array.from(opfDoc.getElementsByTagName('*')).filter((el) => el.localName === 'item');
  for (const item of manifestItems) {
    const id = item.getAttribute('id') || '';
    const href = item.getAttribute('href') || '';
    const mediaType = item.getAttribute('media-type') || '';
    const properties = item.getAttribute('properties') || '';
    if (!id || !href) continue;

    const resolvedPath = resolveRelativePath(opfPath, href);
    manifestMap.set(id, { href: resolvedPath, mediaType, properties });

    if (mediaType === 'application/x-dtbncx+xml') {
      ncxPath = resolvedPath;
    }
    if (properties.split(/\s+/).includes('nav')) {
      navPath = resolvedPath;
    }
  }

  let tocTitles = new Map<string, string>();
  if (navPath) {
    const navText = await readZipEntryText(bytes, entries, navPath);
    if (navText) tocTitles = parseNavXhtmlToc(navText, navPath);
  }
  if (tocTitles.size === 0 && ncxPath) {
    const ncxText = await readZipEntryText(bytes, entries, ncxPath);
    if (ncxText) tocTitles = parseNcxToc(ncxText, ncxPath);
  }

  const spineRefs = Array.from(opfDoc.getElementsByTagName('*'))
    .filter((el) => el.localName === 'itemref')
    .map((el) => el.getAttribute('idref') || '')
    .filter(Boolean);

  if (spineRefs.length === 0) {
    throw new Error('This EPUB spine contains no readable chapters.');
  }

  onProgress?.({ stage: 'finding_chapters', detail: 'Reading chapters and structure…' });
  const bookId = `epub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const chapters: Chapter[] = [];

  for (let i = 0; i < spineRefs.length; i++) {
    onProgress?.({
      stage: 'finding_chapters',
      currentPage: i + 1,
      totalPages: spineRefs.length,
      detail: `Extracting section ${i + 1} of ${spineRefs.length}…`,
    });

    const item = manifestMap.get(spineRefs[i]);
    if (!item || !/html|xml/i.test(item.mediaType)) continue;
    // Skip EPUB3 inline nav TOC page if it has almost no prose
    if (item.properties.split(/\s+/).includes('nav')) continue;

    const htmlText = await readZipEntryText(bytes, entries, item.href);
    if (!htmlText) continue;

    const { heading, paragraphs } = extractChapterContentFromHtml(htmlText);
    const totalSectionChars = paragraphs.reduce((acc, p) => acc + p.length, 0);
    if (paragraphs.length === 0 || totalSectionChars < 20) continue;

    const tocTitle = tocTitles.get(item.href);
    const sectionIndex = chapters.length;
    const chapterTitle = tocTitle || heading || `Section ${sectionIndex + 1}`;
    const label = /^chapter\b/i.test(chapterTitle)
      ? chapterTitle.slice(0, 42)
      : `Chapter ${sectionIndex + 1}`;

    chapters.push({
      id: `${bookId}-ch-${sectionIndex + 1}`,
      index: sectionIndex,
      label,
      title: chapterTitle.slice(0, 120),
      paragraphs,
      estimatedMinutes: estimateReadingMinutes(paragraphs),
    });
  }

  if (chapters.length === 0) {
    throw new Error('No readable prose chapters could be extracted from this EPUB.');
  }

  onProgress?.({ stage: 'building_cover', detail: 'Designing cover and shelf placement…' });
  const wordCount = chapters.reduce(
    (sum, ch) => sum + ch.paragraphs.join(' ').split(/\s+/).filter(Boolean).length,
    0,
  );
  const totalPages = Math.max(1, Math.round(wordCount / 250));
  const sampleText = chapters[0]?.paragraphs.slice(0, 3).join(' ') || '';
  const shelf = suggestShelf(title, sampleText, shelves);
  const coverSpec = pickDeterministicCover(`${title}-${author}`);
  const fallbackDescription = `Imported EPUB · ${chapters.length} chapters · ~${wordCount.toLocaleString()} words stored locally.`;

  let aiBrief: string | undefined;
  let aiThemes: string[] | undefined;

  onProgress?.({ stage: 'categorizing', detail: 'Drafting AI brief about your book…' });
  try {
    const briefResult = await requestBookBrief({
      title,
      author,
      totalPages,
      chapters,
    });
    aiBrief = briefResult.brief;
    aiThemes = briefResult.themes;
  } catch {
    // Graceful local summary fallback if offline.
  }

  const book: Book = {
    id: bookId,
    shelfId: shelf?.id || shelves[0]?.id || 'literature',
    title,
    author,
    year,
    description: aiBrief || fallbackDescription,
    ...(aiBrief ? { aiBrief } : {}),
    ...(aiThemes && aiThemes.length > 0 ? { aiThemes } : {}),
    totalPages,
    isFullSample: true,
    progressPercent: 0,
    lastOpenedAt: Date.now(),
    cover: {
      palette: coverSpec.palette,
      pattern: coverSpec.pattern,
      editionNote: 'EPUB Edition',
    },
    chapters,
  };

  onProgress?.({ stage: 'ready', detail: 'Ready for review.' });

  return {
    book,
    suggestedShelfId: book.shelfId,
    suggestedTone: shelf?.tone,
    warnings,
  };
}
