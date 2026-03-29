import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "papers.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initDb(db);
  }
  return db;
}

function initDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT NOT NULL,
      abstract TEXT,
      published TEXT,
      updated TEXT,
      source_url TEXT,
      pdf_url TEXT,
      categories TEXT,
      summary TEXT,
      embedding TEXT,
      added_at TEXT DEFAULT (datetime('now')),
      read_at TEXT,
      is_read INTEGER DEFAULT 0,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS paper_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_a TEXT NOT NULL,
      paper_b TEXT NOT NULL,
      strength REAL DEFAULT 0.5,
      relation_type TEXT DEFAULT 'similar',
      FOREIGN KEY (paper_a) REFERENCES papers(id),
      FOREIGN KEY (paper_b) REFERENCES papers(id),
      UNIQUE(paper_a, paper_b)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (paper_id) REFERENCES papers(id)
    );
  `);
}

export type Paper = {
  id: string;
  title: string;
  authors: string;
  abstract: string | null;
  published: string | null;
  updated: string | null;
  source_url: string | null;
  pdf_url: string | null;
  categories: string | null;
  summary: string | null;
  embedding: string | null;
  added_at: string;
  read_at: string | null;
  is_read: number;
  notes: string;
};

export type PaperConnection = {
  id: number;
  paper_a: string;
  paper_b: string;
  strength: number;
  relation_type: string;
};

export type ChatMessage = {
  id: number;
  paper_id: string;
  role: string;
  content: string;
  created_at: string;
};
