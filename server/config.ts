import path from 'node:path';
import dotenv from 'dotenv';

const rootDir = path.resolve(import.meta.dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env'), quiet: true });

export interface ServerConfig {
  port: number;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseSecretKey: string;
  supabaseJwksUrl: string;
  geminiApiKey: string;
  geminiModel: string;
  mediastackApiKey: string;
  newsdataApiKey: string;
  allowedOrigins: string[];
}

const rawSupabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const rawJwksUrl = (process.env.SUPABASE_JWKS_URL || '').trim();

const extraAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const serverConfig: ServerConfig = {
  port: Number(process.env.PORT || 3001),
  supabaseUrl: rawSupabaseUrl,
  supabasePublishableKey: (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim(),
  supabaseSecretKey: (process.env.SUPABASE_SECRET_KEY || '').trim(),
  supabaseJwksUrl: rawJwksUrl || (rawSupabaseUrl ? `${rawSupabaseUrl}/auth/v1/.well-known/jwks.json` : ''),
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: (process.env.GEMINI_MODEL || 'gemini-4-hydrogen').trim(),
  mediastackApiKey: (process.env.MEDIASTACK_API_KEY || '').trim(),
  newsdataApiKey: (process.env.NEWSDATA_API_KEY || '').trim(),
  allowedOrigins: Array.from(
    new Set(
      [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175',
        process.env.VITE_NOTES_URL || '',
        process.env.VITE_READER_URL || '',
        process.env.VITE_NEWS_URL || '',
        ...extraAllowedOrigins,
      ]
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean),
    ),
  ),
};

export function assertSupabaseConfigured(): void {
  if (!serverConfig.supabaseUrl || !serverConfig.supabasePublishableKey || !serverConfig.supabaseSecretKey) {
    throw new Error('Supabase server environment variables are not configured.');
  }
}

export function assertGeminiConfigured(): void {
  if (!serverConfig.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
}
