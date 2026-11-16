const ARTICLE_CACHE_TTL_MS = 30 * 60 * 1000;
const cachedArticles = new Map<string, { paragraphs: string[]; fullText: string; expiresAt: number }>();

const BOILERPLATE_LINE_REGEX =
  /^(?:accept(?:\s+all)?|manage\s+cookies?|cookie\s+(?:policy|settings)|subscribe\s+(?:now|to)|sign\s+(?:in|up)|log\s+in|register\s+(?:now|to)|all\s+rights\s+reserved|advertisement|sponsored\s+content|share\s+this(?:\s+article)?|follow\s+us|read\s+more:|related\s+articles?|copyright\s+©|you\s+have\s+permission|please\s+enable\s+javascript|get\s+our\s+pick\b|download\s+(?:the|our)\s+app\b|listen\s+to\s+this\s+article\b|scroll\s+to\s+continue\b)|in\s+your\s+inbox\.?$/i;

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  return false;
}

function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    rsquo: '’',
    lsquo: '‘',
    rdquo: '”',
    ldquo: '“',
    mdash: '—',
    ndash: '–',
    hellip: '…',
    laquo: '«',
    raquo: '»',
  };

  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      const cp = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
    }
    if (code.startsWith('#')) {
      const cp = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
    }
    return named[code.toLowerCase()] ?? match;
  });
}

function cleanTextFragment(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractArticleBodyFromJsonLd(html: string): string[] {
  const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  const findArticleBody = (node: unknown): string | null => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findArticleBody(item);
        if (found) return found;
      }
      return null;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.articleBody === 'string' && obj.articleBody.trim().length > 220) {
      return obj.articleBody.trim();
    }
    if (obj['@graph']) {
      return findArticleBody(obj['@graph']);
    }
    return null;
  };

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const body = findArticleBody(parsed);
      if (body) {
        const splitParagraphs = body
          .split(/\n{2,}|\r\n\r\n/)
          .map((p) => cleanTextFragment(p))
          .filter((p) => p.length >= 40 && !BOILERPLATE_LINE_REGEX.test(p));

        if (splitParagraphs.length >= 2) {
          return splitParagraphs.slice(0, 18);
        }

        // Single-block articleBody: split cleanly every ~2 sentences for readable editorial chunks
        const sentences = cleanTextFragment(body).match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [];
        if (sentences.length >= 4) {
          const chunks: string[] = [];
          for (let i = 0; i < sentences.length; i += 3) {
            const chunk = sentences.slice(i, i + 3).join(' ').trim();
            if (chunk.length >= 40) chunks.push(chunk);
          }
          if (chunks.length >= 2) return chunks.slice(0, 14);
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  }

  return [];
}

function extractParagraphsFromHtml(html: string): string[] {
  const strippedNoise = html
    .replace(/<(script|style|noscript|svg|header|footer|nav|aside|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const articleMatch =
    strippedNoise.match(/<article\b[\s\S]*?<\/article>/i) ||
    strippedNoise.match(/<main\b[\s\S]*?<\/main>/i);
  const scope = articleMatch ? articleMatch[0] : strippedNoise;

  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  const seen = new Set<string>();
  const paragraphs: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pRegex.exec(scope)) !== null) {
    const text = cleanTextFragment(match[1]);
    if (text.length < 48 || text.length > 2200) continue;
    if (BOILERPLATE_LINE_REGEX.test(text)) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    paragraphs.push(text);
    if (paragraphs.length >= 18) break;
  }

  return paragraphs;
}

/**
 * Fetches full publisher reporting paragraphs from an article URL safely on the server.
 */
export async function fetchFullArticleText(
  originalUrl: string | undefined,
): Promise<{ paragraphs: string[]; fullText: string } | null> {
  if (!originalUrl) return null;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(originalUrl);
  } catch {
    return null;
  }

  if ((parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') || isPrivateOrLocalHostname(parsedUrl.hostname)) {
    return null;
  }

  const cacheKey = parsedUrl.toString();
  const cached = cachedArticles.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { paragraphs: cached.paragraphs, fullText: cached.fullText };
  }

  try {
    const res = await fetch(cacheKey, {
      redirect: 'follow',
      signal: AbortSignal.timeout(7000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!/html|xml|text/i.test(contentType)) return null;

    const html = (await res.text()).slice(0, 800_000);
    const jsonLdParagraphs = extractArticleBodyFromJsonLd(html);
    const htmlParagraphs = jsonLdParagraphs.length >= 2 ? jsonLdParagraphs : extractParagraphsFromHtml(html);

    if (htmlParagraphs.length < 2) {
      return null;
    }

    const fullText = htmlParagraphs.join('\n\n').slice(0, 7500);
    const result = { paragraphs: htmlParagraphs, fullText };
    cachedArticles.set(cacheKey, {
      ...result,
      expiresAt: Date.now() + ARTICLE_CACHE_TTL_MS,
    });
    return result;
  } catch {
    return null;
  }
}
