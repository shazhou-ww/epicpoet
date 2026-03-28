import Database from 'better-sqlite3';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT,
  description TEXT,
  traits TEXT,
  status TEXT DEFAULT 'alive',
  first_appearance_epoch INTEGER,
  file_path TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  epoch INTEGER NOT NULL,
  end_epoch INTEGER,
  location TEXT,
  participants TEXT,
  visibility TEXT DEFAULT 'participants',
  tags TEXT,
  file_path TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  title TEXT,
  event_id TEXT,
  epoch INTEGER,
  location TEXT,
  pov TEXT,
  characters TEXT,
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  file_path TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  title TEXT,
  number INTEGER,
  summary TEXT,
  scenes TEXT,
  status TEXT DEFAULT 'draft',
  file_path TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS character_knowledge (
  character_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  at_epoch INTEGER NOT NULL,
  method TEXT,
  source TEXT,
  notes TEXT,
  PRIMARY KEY (character_id, event_id),
  FOREIGN KEY (character_id) REFERENCES characters(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent TEXT,
  tags TEXT,
  file_path TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  tags TEXT,
  file_path TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  location TEXT,
  tags TEXT,
  file_path TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

export const INDEXES = `
CREATE INDEX IF NOT EXISTS idx_events_epoch ON events(epoch);
CREATE INDEX IF NOT EXISTS idx_knowledge_character_epoch ON character_knowledge(character_id, at_epoch);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility, epoch);
CREATE INDEX IF NOT EXISTS idx_scenes_event ON scenes(event_id);
CREATE INDEX IF NOT EXISTS idx_scenes_epoch ON scenes(epoch);
CREATE INDEX IF NOT EXISTS idx_chapters_number ON chapters(number);
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent);
`;

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  db.exec(INDEXES);
  return db;
}
