<p align="center">
  <img src="public/graphene.png" width="80" alt="Graphene" />
</p>

<h1 align="center">Graphene</h1>

<p align="center">
  Open source research paper management with AI.
</p>

<p align="center">
  <a href="#features">Features</a> · <a href="#setup">Setup</a> · <a href="#self-hosting">Self-Hosting</a> · <a href="#stack">Stack</a>
</p>

---

## Features

- **Paper ingestion** — Paste any arXiv URL, PDF link, or paper webpage. Graphene scrapes metadata, downloads PDFs, and stores everything.
- **Knowledge graph** — Visual map of all your papers with category clusters and connections between related work.
- **AI summaries** — Claude generates concise summaries from the full paper text (HTML preferred, PDF fallback).
- **AI chat** — Ask questions about any paper. Claude has full context including the summary, scores, and metadata.
- **Paper reader** — Embedded PDF viewer for reading papers inline.
- **Reading tracker** — Mark papers as read, filter by status, take notes.
- **Legitness score** — AI rates each paper on honesty, rigor, novelty, credibility, and reproducibility.
- **Interesting score** — Separate from legitness. Judges the idea, not the execution.
- **Sort & filter** — By date added, date published, legitness, interesting score, category, read status.
- **Resizable panels** — Drag to resize, collapse any panel.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Supabase](https://supabase.com/) project (free tier works)
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone and install

```bash
git clone https://github.com/lance116/Graphene.git
cd Graphene
npm install
```

### 2. Set up Supabase

Create a new Supabase project, then run this SQL in the SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors JSONB NOT NULL DEFAULT '[]',
  abstract TEXT,
  published TIMESTAMPTZ,
  source_url TEXT,
  pdf_url TEXT,
  categories JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  bs_score JSONB,
  user_id UUID
);

CREATE TABLE IF NOT EXISTS paper_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_a TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  paper_b TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  strength REAL DEFAULT 0.5,
  relation_type TEXT DEFAULT 'similar',
  user_id UUID,
  UNIQUE(paper_a, paper_b)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('papers', 'papers', true) ON CONFLICT DO NOTHING;
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in your keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Self-Hosting

### Vercel

1. Fork this repo
2. Import to [Vercel](https://vercel.com)
3. Add the environment variables above
4. Deploy

> Note: The AI enrichment endpoint can take 30-60s. Vercel free tier has a 10s timeout — you'll need [Vercel Pro](https://vercel.com/pricing) ($20/mo) for enrichment to work reliably. Basic paper adding and viewing works on free tier.

### Other platforms

Works anywhere Next.js runs — Railway, Fly.io, Render, self-hosted VPS, etc.

## Stack

- **Next.js 16** — App router, API routes
- **Supabase** — Postgres database, auth, file storage
- **Claude Opus 4.6** — Summaries, ratings, chat, metadata extraction
- **react-force-graph-2d** — Knowledge graph visualization
- **Tailwind CSS v4** — Styling

## License

MIT
