<p align="center">
  <img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/banner.svg" alt="Paper & Ink: notes, books, and news, picked up from a shelf" width="100%">
</p>

---

<h2 align="center">About</h2>

<p align="center">
  <b>Paper & Ink</b> is the set of apps I use every day:<br>
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
  <a href="https://notes.hasankarasu.me/"><img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/btn-open-notes.svg" alt="Open Notes" height="52"></a>
</p>

---

<h2 align="center">Reader</h2>

<p align="center">A calm book reader. Add a PDF and it becomes clean, reflowable text, organized into chapters, with a built-in dictionary, saved quotes, and bookmarks. Books sit on acrylic shelves in your library.</p>

<p align="center">
  <img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/Reader.png" alt="Reader app screens" width="30%">
</p>

<p align="center">
  <a href="https://reader.hasankarasu.me/"><img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/btn-open-reader.svg" alt="Open Reader" height="52"></a>
</p>

---

<h2 align="center">News</h2>

<p align="center">A personal news app. Choose your topics and writing style, and get short summaries in your own voice, always with the source and a link to the original.</p>

<p align="center">
  <img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/News.png" alt="News app screens" width="30%">
</p>

<p align="center">
  <a href="https://news.hasankarasu.me/"><img src="https://hkupwitqqndmolvtgfsm.supabase.co/storage/v1/object/public/stuff/btn-open-news.svg" alt="Open News" height="52"></a>
</p>

---

<details>
<summary><b>Technical documentation</b></summary>

<br>

Paper & Ink is a local-first productivity and reading suite built with React 19, Vite 8, TypeScript, and Tailwind CSS v4. A lightweight Express server handles **Supabase username authentication** and **server-side Gemini OCR and scanned-PDF extraction**.

| Application | Purpose | Live URL | Default local URL | Icon source |
| :--- | :--- | :--- | :--- | :--- |
| **Reader** | Personal library, EPUB/TXT/PDF reading, dictionary lookup, quote saving | [reader.hasankarasu.me](https://reader.hasankarasu.me/) | `http://localhost:5173` | `reader-web/icon.png` |
| **Notes** | Tactile notebooks, `perfect-freehand` ink canvas, handwriting OCR, action capture | [notes.hasankarasu.me](https://notes.hasankarasu.me/) | `http://localhost:5174` | `notes-web/icon.png` |
| **News** | Calm editorial daily briefing, reading-style AI voice selector, saved stories | [news.hasankarasu.me](https://news.hasankarasu.me/) | `http://localhost:5175` | `news-web/icon.png` |
| **Backend API (`server/`)** | Username auth proxy (Supabase), Gemini OCR/PDF/news summarization, NewsData/Mediastack proxy | — | `http://localhost:3001` | none |

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
