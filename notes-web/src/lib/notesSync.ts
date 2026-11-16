import { getSupabaseBrowserClient, readCachedProfile } from '@paper-and-ink/auth';
import type { InkStroke } from '../types/ink';
import type { ConversionResult, NotePage } from '../types/note';
import type { CoverColor, Notebook, NotebookCategory } from '../types/notebook';

interface DbNotebookRow {
  user_id: string;
  id: string;
  title: string;
  subtitle: string | null;
  category: NotebookCategory;
  cover_color: CoverColor;
  page_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

interface DbNotePageRow {
  user_id: string;
  id: string;
  notebook_id: string;
  title: string;
  content: string;
  ink_strokes: InkStroke[] | null;
  original_image: string | null;
  tags: string[] | null;
  conversion_result: ConversionResult | null;
  created_at: string;
  updated_at: string;
}

export function getSignedInUserId(): string | null {
  const profile = readCachedProfile();
  return profile?.id ?? null;
}

function mapRowToNotebook(row: DbNotebookRow): Notebook {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    category: row.category,
    coverColor: row.cover_color,
    pageIds: Array.isArray(row.page_ids) ? row.page_ids : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotebookToRow(userId: string, nb: Notebook): DbNotebookRow {
  return {
    user_id: userId,
    id: nb.id,
    title: nb.title,
    subtitle: nb.subtitle ?? null,
    category: nb.category,
    cover_color: nb.coverColor,
    page_ids: nb.pageIds,
    created_at: nb.createdAt,
    updated_at: nb.updatedAt,
  };
}

function mapRowToPage(row: DbNotePageRow): NotePage {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    title: row.title,
    content: row.content,
    inkStrokes: Array.isArray(row.ink_strokes) ? row.ink_strokes : [],
    originalImage: row.original_image ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    conversionResult: row.conversion_result ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
  };
}

function mapPageToRow(userId: string, page: NotePage): DbNotePageRow {
  return {
    user_id: userId,
    id: page.id,
    notebook_id: page.notebookId,
    title: page.title,
    content: page.content,
    ink_strokes: page.inkStrokes,
    original_image: page.originalImage ?? null,
    tags: page.tags,
    conversion_result: page.conversionResult ?? null,
    created_at: page.createdAt,
    updated_at: page.updatedAt,
  };
}

async function getAuthedClientForUser(expectedUserId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  const sessionUserId = data.session?.user?.id;
  if (!sessionUserId || sessionUserId !== expectedUserId) {
    return null;
  }
  return client;
}

export async function pullNotesFromDb(
  userId: string,
): Promise<{ notebooks: Notebook[]; pages: NotePage[] }> {
  const client = await getAuthedClientForUser(userId);
  if (!client) {
    throw new Error('Supabase session not ready for cloud sync.');
  }

  const [nbRes, pageRes] = await Promise.all([
    client
      .from('notebooks')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    client
      .from('note_pages')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  ]);

  if (nbRes.error) throw new Error(nbRes.error.message);
  if (pageRes.error) throw new Error(pageRes.error.message);

  return {
    notebooks: ((nbRes.data || []) as DbNotebookRow[]).map(mapRowToNotebook),
    pages: ((pageRes.data || []) as DbNotePageRow[]).map(mapRowToPage),
  };
}

export async function upsertNotebookInDb(userId: string, notebook: Notebook): Promise<void> {
  const client = await getAuthedClientForUser(userId);
  if (!client) return;

  const { error } = await client
    .from('notebooks')
    .upsert(mapNotebookToRow(userId, notebook), { onConflict: 'user_id,id' });
  if (error) throw new Error(error.message);
}

export async function deleteNotebookInDb(userId: string, notebookId: string): Promise<void> {
  const client = await getAuthedClientForUser(userId);
  if (!client) return;

  const { error } = await client
    .from('notebooks')
    .delete()
    .eq('user_id', userId)
    .eq('id', notebookId);
  if (error) throw new Error(error.message);
}

export async function upsertPageInDb(userId: string, page: NotePage): Promise<void> {
  const client = await getAuthedClientForUser(userId);
  if (!client) return;

  const { error } = await client
    .from('note_pages')
    .upsert(mapPageToRow(userId, page), { onConflict: 'user_id,id' });
  if (error) throw new Error(error.message);
}

export async function deletePageInDb(userId: string, pageId: string): Promise<void> {
  const client = await getAuthedClientForUser(userId);
  if (!client) return;

  const { error } = await client
    .from('note_pages')
    .delete()
    .eq('user_id', userId)
    .eq('id', pageId);
  if (error) throw new Error(error.message);
}

export async function pushNotebooksAndPagesToDb(
  userId: string,
  notebooks: Notebook[],
  pages: NotePage[],
): Promise<void> {
  const client = await getAuthedClientForUser(userId);
  if (!client) return;

  if (notebooks.length > 0) {
    const { error: nbErr } = await client
      .from('notebooks')
      .upsert(
        notebooks.map((nb) => mapNotebookToRow(userId, nb)),
        { onConflict: 'user_id,id' },
      );
    if (nbErr) throw new Error(nbErr.message);
  }

  if (pages.length > 0) {
    const { error: pageErr } = await client
      .from('note_pages')
      .upsert(
        pages.map((p) => mapPageToRow(userId, p)),
        { onConflict: 'user_id,id' },
      );
    if (pageErr) throw new Error(pageErr.message);
  }
}
