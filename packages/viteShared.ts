import fs from 'node:fs';
import path from 'node:path';

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * Safely reads public-only environment values from the workspace root .env
 * (or process.env) without ever exposing SUPABASE_SECRET_KEY, OPENROUTER_API_KEY,
 * or news provider API keys to browser bundles.
 *
 * When building for independent production hosting (isServe = false), sibling app
 * URLs default to empty strings unless explicitly configured in environment
 * variables, avoiding hardcoded localhost links in independently hosted builds.
 */
export function buildSafeClientDefine(
  rootDir: string,
  options?: { isServe?: boolean },
): Record<string, string> {
  const rootEnvPath = path.join(rootDir, '.env');
  const localEnvPath = path.resolve(process.cwd(), '.env');

  let parsed: Record<string, string> = {};
  if (fs.existsSync(rootEnvPath)) {
    parsed = { ...parsed, ...parseEnvFile(fs.readFileSync(rootEnvPath, 'utf8')) };
  }
  if (localEnvPath !== rootEnvPath && fs.existsSync(localEnvPath)) {
    parsed = { ...parsed, ...parseEnvFile(fs.readFileSync(localEnvPath, 'utf8')) };
  }

  const pick = (key: string, fallback = '') =>
    (process.env[key] || parsed[key] || fallback).trim();

  const isServe = Boolean(options?.isServe);
  const supabaseUrl = pick('VITE_SUPABASE_URL') || pick('SUPABASE_URL');
  const supabasePublishableKey =
    pick('VITE_SUPABASE_PUBLISHABLE_KEY') || pick('SUPABASE_PUBLISHABLE_KEY');

  return {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabasePublishableKey),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(pick('VITE_API_BASE_URL')),
    'import.meta.env.VITE_READER_URL': JSON.stringify(
      pick('VITE_READER_URL', isServe ? 'http://localhost:5173' : ''),
    ),
    'import.meta.env.VITE_NOTES_URL': JSON.stringify(
      pick('VITE_NOTES_URL', isServe ? 'http://localhost:5174' : ''),
    ),
    'import.meta.env.VITE_NEWS_URL': JSON.stringify(
      pick('VITE_NEWS_URL', isServe ? 'http://localhost:5175' : ''),
    ),
  };
}

export function buildSharedAliases(rootDir: string) {
  return {
    '@paper-and-ink/design-system': path.join(rootDir, 'packages', 'design-system'),
    '@paper-and-ink/auth': path.join(rootDir, 'packages', 'auth'),
  };
}
