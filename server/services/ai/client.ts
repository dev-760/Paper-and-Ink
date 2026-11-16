import { assertGeminiConfigured, serverConfig } from '../../config.ts';

export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; imageUrl: { url: string } };

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AiContentPart[];
}

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; thought?: boolean }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

function stripReasoningArtifacts(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .trim();
}

function toGeminiParts(content: string | AiContentPart[]): GeminiPart[] {
  if (typeof content === 'string') {
    return content.trim() ? [{ text: content }] : [];
  }

  const parts: GeminiPart[] = [];
  for (const item of content) {
    if (item.type === 'text') {
      if (item.text.trim()) {
        parts.push({ text: item.text });
      }
      continue;
    }

    if (item.type === 'image_url') {
      const match = item.imageUrl.url.match(
        /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/,
      );
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }
  }
  return parts;
}

export async function runModelCompletion(options: {
  messages: AiChatMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  assertGeminiConfigured();

  const systemParts: GeminiPart[] = [];
  const contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }> = [];

  for (const msg of options.messages) {
    if (msg.role === 'system') {
      systemParts.push(...toGeminiParts(msg.content));
      continue;
    }

    const parts = toGeminiParts(msg.content);
    if (parts.length > 0) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts,
      });
    }
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(serverConfig.geminiModel)}:generateContent`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': serverConfig.geminiApiKey,
    },
    body: JSON.stringify({
      ...(systemParts.length > 0 ? { systemInstruction: { parts: systemParts } } : {}),
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: Math.max(options.maxTokens ?? 4096, 3072),
        ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    }),
    signal: AbortSignal.timeout(60000),
  });

  const data = (await response.json().catch(() => ({}))) as GeminiGenerateContentResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `Gemini API request failed (HTTP ${response.status}).`);
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  const rawText = parts
    .filter((p) => !p.thought)
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('\n');
  const text = stripReasoningArtifacts(rawText);

  if (!text) {
    throw new Error('The AI model returned an empty response.');
  }
  return text;
}

export function extractJsonObject<T>(rawText: string): T | null {
  const cleaned = stripReasoningArtifacts(rawText)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
