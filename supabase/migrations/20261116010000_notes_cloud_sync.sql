-- Paper & Ink Notes: Cross-Device Notebooks & Pages Cloud Persistence
-- Enforces strict owner-scoped RLS via authenticated Supabase Auth UID.

CREATE TABLE IF NOT EXISTS public.notebooks (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL CHECK (char_length(id) BETWEEN 1 AND 128),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  subtitle text,
  category text NOT NULL CHECK (char_length(trim(category)) BETWEEN 1 AND 60),
  cover_color text NOT NULL CHECK (cover_color IN ('navy', 'terracotta', 'sage', 'tan', 'plum', 'forest')),
  page_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS notebooks_user_updated_idx
  ON public.notebooks (user_id, updated_at DESC);

ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notebooks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notebooks TO authenticated;
GRANT ALL ON TABLE public.notebooks TO service_role;

DROP POLICY IF EXISTS "Users can select own notebooks" ON public.notebooks;
CREATE POLICY "Users can select own notebooks"
  ON public.notebooks FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own notebooks" ON public.notebooks;
CREATE POLICY "Users can insert own notebooks"
  ON public.notebooks FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own notebooks" ON public.notebooks;
CREATE POLICY "Users can update own notebooks"
  ON public.notebooks FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own notebooks" ON public.notebooks;
CREATE POLICY "Users can delete own notebooks"
  ON public.notebooks FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.note_pages (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL CHECK (char_length(id) BETWEEN 1 AND 128),
  notebook_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  ink_strokes jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_image text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  conversion_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, notebook_id) REFERENCES public.notebooks (user_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS note_pages_user_notebook_idx
  ON public.note_pages (user_id, notebook_id, updated_at DESC);

ALTER TABLE public.note_pages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.note_pages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.note_pages TO authenticated;
GRANT ALL ON TABLE public.note_pages TO service_role;

DROP POLICY IF EXISTS "Users can select own note pages" ON public.note_pages;
CREATE POLICY "Users can select own note pages"
  ON public.note_pages FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own note pages" ON public.note_pages;
CREATE POLICY "Users can insert own note pages"
  ON public.note_pages FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own note pages" ON public.note_pages;
CREATE POLICY "Users can update own note pages"
  ON public.note_pages FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own note pages" ON public.note_pages;
CREATE POLICY "Users can delete own note pages"
  ON public.note_pages FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
