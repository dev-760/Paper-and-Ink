<p align="center">
  <img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/banner.svg" alt="Paper &amp; Ink: notes, books, and news, picked up from a shelf" width="100%">
</p>

---

<h2 align="center">About</h2>

<p align="center">
  <b>Paper &amp; Ink</b> is the set of apps I use every day:<br>
  one for notes, one for books, and one for news.
</p>

<p align="center">
  I built them around my own needs, with <b>privacy first</b> and <b>zero ads</b>,<br>
  and a calm design that stays out of the way.
</p>

---

<h2 align="center">Notes</h2>

<p align="center">A notebook-shelf note app for phone, laptop, and tablet with a pen. Type, write with ink, or photograph your handwriting, and it becomes clean, organized notes. Your original is always kept next to the cleaned version.</p>

<p align="center">
  <img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/Notes.png" alt="Notes app screens" width="30%">
</p>

<p align="center">
  <a href="#"><img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/btn-open-notes.svg" alt="Open Notes" height="52"></a>
</p>

---

<h2 align="center">Reader</h2>

<p align="center">A calm book reader. Add a PDF and it becomes clean, reflowable text, organized into chapters, with a built-in dictionary, saved quotes, and bookmarks. Books sit on acrylic shelves in your library.</p>

<p align="center">
  <img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/Reader.png" alt="Reader app screens" width="30%">
</p>

<p align="center">
  <a href="#"><img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/btn-open-reader.svg" alt="Open Reader" height="52"></a>
</p>

---

<h2 align="center">News</h2>

<p align="center">A personal news app. Choose your topics and writing style, and get short summaries in your own voice, always with the source and a link to the original.</p>

<p align="center">
  <img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/News.png" alt="News app screens" width="30%">
</p>

<p align="center">
  <a href="#"><img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/btn-open-news.svg" alt="Open News" height="52"></a>
</p>

---

<details>
<summary><b>Technical documentation</b></summary>

<br>

Paper & Ink is a local-first productivity and reading suite built with React 19, Vite 8, TypeScript, and Tailwind CSS v4. A lightweight Express server handles **Supabase username authentication** and **server-side Gemini OCR and scanned-PDF extraction**.

| Application | Purpose | Default local URL | Icon source |
| :--- | :--- | :--- | :--- |
| **Reader** | Personal library, EPUB/TXT/PDF reading, dictionary lookup, quote saving | `http://localhost:5173` | `reader-web/icon.png` |
| **Notes** | Tactile notebooks, `perfect-freehand` ink canvas, handwriting OCR, action capture | `http://localhost:5174` | `notes-web/icon.png` |
| **News** | Calm editorial daily briefing, reading-style AI voice selector, saved stories | `http://localhost:5175` | `news-web/icon.png` |
| **Backend API (`server/`)** | Username auth proxy (Supabase), Gemini OCR/PDF/news summarization, NewsData/Mediastack proxy | `http://localhost:3001` | none |

### Architecture and privacy boundaries

**Storage (local-first, with cloud sync for Notes)**

- **Reader:** books, imported PDFs (binary store and extracted chapters), reading progress, highlights, bookmarks, quotes, vocabulary, and typography settings stay in the browser (IndexedDB / `localStorage`).
- **Notes:** when signed in, notebooks, typed notes, vector `inkStrokes`, captured handwriting images (`originalImage`), and OCR results are stored in **Supabase PostgreSQL** (`public.notebooks`, `public.note_pages`, owner-only RLS) for cross-device use, with an IndexedDB offline cache (`user_<uuid>`). Guest sessions stay local.
- **News:** topics, reading voice, saved articles, and appearance settings stay in browser storage.

Every local store is account-scoped (`guest` or `user_<uuid>`). Logging out clears only the active Supabase session and returns to the `guest` workspace without deleting cached data.

**Authentication (Supabase)**

- Sign up with **username**, **name**, **password**, and an optional profile photo (max 2 MB, PNG/JPEG/WEBP). No email address or phone number is required.
- Username uniqueness and lookup run server-side with `SUPABASE_SECRET_KEY` and service-role-only RPCs (`register_username_identity`, `resolve_username_identity`).
- Failed sign-ins always return the same `401 Invalid username or password.` and are rate limited, to prevent username enumeration.
- `public.profiles` uses owner-only RLS (`auth.uid() = id`); the `avatars` bucket is private and limited to 2 MB image types.

**Server-side AI and live news (Gemini, NewsData.io, Mediastack)**

All AI and news-provider requests run inside [`server/`](server/index.ts), using the Gemini API with the server-side `GEMINI_API_KEY`:

- `POST /api/ai/ocr`: transcribes handwritten canvases or note photos into a title, summary, key points, and tasks. The original ink and photo are preserved.
- `POST /api/ai/pdf-extract`: cleans extracted text, or OCRs rasterized scanned pages, into readable chapters.
- `GET /api/news/feed`: fetches deduplicated country-based articles from NewsData.io and Mediastack, caches editions per country in memory (15 min TTL), and rewrites stories in the chosen voice (`brief`, `explainer`, `witty`, `plain`).
- `POST /api/news/summarize`: rewrites a single opened story in the selected voice.
- `GET /` and `GET /api/health`: return `paper-and-ink-api is running`.

`GEMINI_API_KEY`, `MEDIASTACK_API_KEY`, `NEWSDATA_API_KEY`, and `SUPABASE_SECRET_KEY` are never bundled into frontend builds.

### Repository structure

```text
Paper & Ink/
├── DESIGN.md                        # Shared design system
├── README.md
├── .env.example                     # Environment variable template
├── package.json                     # Root orchestration and backend dependencies
├── scripts/
│   ├── run-all.mjs                  # Cross-app dev/build/lint runner
│   └── run-app.mjs                  # Windows-safe per-app runner
├── packages/
│   ├── viteShared.ts                # Client env injection and workspace aliases
│   ├── auth/                        # Shared auth hook, guest onboarding, account scoping
│   └── design-system/               # Shared CSS tokens, TS tokens, UI, auth views
├── server/                          # Express backend (:3001)
│   ├── routes/                      # /api/auth/*, /api/ai/*, /api/news/*
│   └── services/                    # Supabase admin, Gemini OCR/PDF, news ingestion
├── supabase/
│   └── migrations/                  # Schema, RPCs, RLS, avatars bucket policies
├── reader-web/                      # Library and reading app (:5173)
├── notes-web/                       # Notebook and handwriting studio (:5174)
└── news-web/                        # Editorial news app (:5175)
```

### Setup and running locally

**1. Environment variables.** Copy `.env.example` to `.env` at the repository root and fill in your credentials:

```env
GEMINI_API_KEY=
GEMINI_MODEL=
MEDIASTACK_API_KEY=
NEWSDATA_API_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=
ALLOWED_ORIGINS=
```

In local dev, `VITE_READER_URL`, `VITE_NOTES_URL`, and `VITE_NEWS_URL` default to ports `5173`, `5174`, and `5175`, and `/api` proxies to `http://127.0.0.1:3001`. In production builds the sibling URLs stay unset unless you provide them.

**2. Database migrations.** Apply both [`20261116000000_auth_profiles.sql`](supabase/migrations/20261116000000_auth_profiles.sql) and [`20261116010000_notes_cloud_sync.sql`](supabase/migrations/20261116010000_notes_cloud_sync.sql) to your Supabase project. They create `app_private.username_identities`, `public.profiles`, the private `avatars` bucket, the username RPCs, and the owner-scoped `public.notebooks` and `public.note_pages` tables.

**3. Install dependencies.**

```bash
npm install
npm --prefix reader-web install
npm --prefix notes-web install
npm --prefix news-web install
```

**4. Run and verify** from the repository root:

```bash
npm run dev     # backend (:3001) + Reader (:5173) + Notes (:5174) + News (:5175)
npm run lint    # typecheck the server and all three apps
npm run build   # typecheck and build dist/ for all three apps
```

**5. Hosting each app separately.** Each frontend builds its own static `dist/` bundle and keeps user content under its own origin.

- Set `VITE_API_BASE_URL` on each frontend to your deployed `server/` URL, plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Set `ALLOWED_ORIGINS` on `server/` to a comma-separated list of the deployed app origins.
- Leave `VITE_READER_URL`, `VITE_NOTES_URL`, and `VITE_NEWS_URL` unset on standalone deployments, or set them to the deployed URLs so the header `AppSwitcher` links between the sites.

</details>

---

<p align="center">
  <img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/Paper%20%26%20Ink.png" alt="Paper &amp; Ink logo" height="100">
  <br><br>
  <sub>Designed and built by <b>Hassan Karasu</b></sub>
  <br>
  <sub>Made with the <a href="DESIGN.md">Paper &amp; Ink design system</a> · © 2026</sub>
</p>
