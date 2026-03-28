import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import YAML from 'yaml';
import matter from 'gray-matter';
import { Character, Event, SceneFrontmatter, Chapter, Location, Concept, Item } from '../models/types';

export interface SyncResult {
  characters: number;
  events: number;
  scenes: number;
  chapters: number;
  locations: number;
  concepts: number;
  items: number;
  removed: number;
}

export function findProjectRoot(startDir?: string): string {
  let dir = startDir || process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, 'universe.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('Could not find universe.yaml in current directory or any parent. Are you inside an EpicPoet project?');
    }
    dir = parent;
  }
}

function readYamlFiles<T>(dirPath: string): Array<{ data: T; filePath: string }> {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  return files.map(f => {
    const fullPath = path.join(dirPath, f);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const data = YAML.parse(content) as T;
    const relativePath = path.relative(path.dirname(dirPath), fullPath);
    return { data, filePath: relativePath };
  });
}

export function syncCharacters(db: Database.Database, projectRoot: string): number {
  const dir = path.join(projectRoot, 'characters');
  const entries = readYamlFiles<Character>(dir);
  const now = new Date().toISOString();

  const upsertChar = db.prepare(`
    INSERT OR REPLACE INTO characters (id, name, aliases, description, traits, status, first_appearance_epoch, file_path, updated_at)
    VALUES (@id, @name, @aliases, @description, @traits, @status, @first_appearance_epoch, @file_path, @updated_at)
  `);

  const upsertKnowledge = db.prepare(`
    INSERT OR REPLACE INTO character_knowledge (character_id, event_id, at_epoch, method, source, notes)
    VALUES (@character_id, @event_id, @at_epoch, @method, @source, @notes)
  `);

  for (const { data, filePath } of entries) {
    upsertChar.run({
      id: data.id,
      name: data.name,
      aliases: JSON.stringify(data.aliases || []),
      description: data.description || '',
      traits: JSON.stringify(data.traits || []),
      status: data.status || 'alive',
      first_appearance_epoch: data.first_appearance_epoch ?? null,
      file_path: filePath,
      updated_at: now,
    });

    if (data.learns) {
      for (const learn of data.learns) {
        upsertKnowledge.run({
          character_id: data.id,
          event_id: learn.event,
          at_epoch: learn.at_epoch,
          method: learn.method || null,
          source: learn.source || null,
          notes: learn.notes || null,
        });
      }
    }
  }

  return entries.length;
}

export function syncEvents(db: Database.Database, projectRoot: string): number {
  const dir = path.join(projectRoot, 'events');
  const entries = readYamlFiles<Event>(dir);
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO events (id, title, description, epoch, end_epoch, location, participants, visibility, tags, file_path, updated_at)
    VALUES (@id, @title, @description, @epoch, @end_epoch, @location, @participants, @visibility, @tags, @file_path, @updated_at)
  `);

  for (const { data, filePath } of entries) {
    upsert.run({
      id: data.id,
      title: data.title,
      description: data.description || '',
      epoch: data.epoch,
      end_epoch: data.end_epoch ?? null,
      location: data.location || '',
      participants: JSON.stringify(data.participants || []),
      visibility: data.visibility || 'participants',
      tags: JSON.stringify(data.tags || []),
      file_path: filePath,
      updated_at: now,
    });
  }

  return entries.length;
}

export function syncScenes(db: Database.Database, projectRoot: string): number {
  const dir = path.join(projectRoot, 'scenes');
  if (!fs.existsSync(dir)) return 0;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO scenes (id, title, event_id, epoch, location, pov, characters, summary, word_count, status, file_path, updated_at)
    VALUES (@id, @title, @event_id, @epoch, @location, @pov, @characters, @summary, @word_count, @status, @file_path, @updated_at)
  `);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const { data, content } = matter(raw);
    const fm = data as SceneFrontmatter;
    const wordCount = content.trim().split(/\s+/).filter(w => w.length > 0).length;
    const relativePath = path.join('scenes', file);

    upsert.run({
      id: fm.id,
      title: fm.title || '',
      event_id: fm.event || null,
      epoch: fm.epoch ?? null,
      location: fm.location || '',
      pov: fm.pov || '',
      characters: JSON.stringify(fm.characters || []),
      summary: fm.summary || '',
      word_count: wordCount,
      status: fm.status || 'draft',
      file_path: relativePath,
      updated_at: now,
    });
  }

  return files.length;
}

export function syncChapters(db: Database.Database, projectRoot: string): number {
  const dir = path.join(projectRoot, 'chapters');
  const entries = readYamlFiles<Chapter>(dir);
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO chapters (id, title, number, summary, scenes, status, file_path, updated_at)
    VALUES (@id, @title, @number, @summary, @scenes, @status, @file_path, @updated_at)
  `);

  for (const { data, filePath } of entries) {
    upsert.run({
      id: data.id,
      title: data.title || '',
      number: data.number ?? null,
      summary: data.summary || '',
      scenes: JSON.stringify(data.scenes || []),
      status: data.status || 'draft',
      file_path: filePath,
      updated_at: now,
    });
  }

  return entries.length;
}

export function syncLocations(db: Database.Database, projectRoot: string): number {
  const dir = path.join(projectRoot, 'locations');
  const entries = readYamlFiles<Location>(dir);
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO locations (id, name, description, parent, tags, file_path, updated_at)
    VALUES (@id, @name, @description, @parent, @tags, @file_path, @updated_at)
  `);

  for (const { data, filePath } of entries) {
    upsert.run({
      id: data.id,
      name: data.name,
      description: data.description || '',
      parent: data.parent || null,
      tags: JSON.stringify(data.tags || []),
      file_path: filePath,
      updated_at: now,
    });
  }

  return entries.length;
}

export function syncConcepts(db: Database.Database, projectRoot: string): number {
  const dir = path.join(projectRoot, 'concepts');
  const entries = readYamlFiles<Concept>(dir);
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO concepts (id, name, category, description, tags, file_path, updated_at)
    VALUES (@id, @name, @category, @description, @tags, @file_path, @updated_at)
  `);

  for (const { data, filePath } of entries) {
    upsert.run({
      id: data.id,
      name: data.name,
      category: data.category || '',
      description: data.description || '',
      tags: JSON.stringify(data.tags || []),
      file_path: filePath,
      updated_at: now,
    });
  }

  return entries.length;
}

export function syncItems(db: Database.Database, projectRoot: string): number {
  const dir = path.join(projectRoot, 'items');
  const entries = readYamlFiles<Item>(dir);
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO items (id, name, description, owner, location, tags, file_path, updated_at)
    VALUES (@id, @name, @description, @owner, @location, @tags, @file_path, @updated_at)
  `);

  for (const { data, filePath } of entries) {
    upsert.run({
      id: data.id,
      name: data.name,
      description: data.description || '',
      owner: data.owner || null,
      location: data.location || null,
      tags: JSON.stringify(data.tags || []),
      file_path: filePath,
      updated_at: now,
    });
  }

  return entries.length;
}

export function cleanupStale(db: Database.Database, projectRoot: string): number {
  let removed = 0;
  const tables: Array<{ table: string; dir: string; ext: string }> = [
    { table: 'characters', dir: 'characters', ext: '.yaml' },
    { table: 'events', dir: 'events', ext: '.yaml' },
    { table: 'scenes', dir: 'scenes', ext: '.md' },
    { table: 'chapters', dir: 'chapters', ext: '.yaml' },
    { table: 'locations', dir: 'locations', ext: '.yaml' },
    { table: 'concepts', dir: 'concepts', ext: '.yaml' },
    { table: 'items', dir: 'items', ext: '.yaml' },
  ];

  for (const { table, dir, ext } of tables) {
    const rows = db.prepare(`SELECT id, file_path FROM ${table}`).all() as Array<{ id: string; file_path: string }>;
    for (const row of rows) {
      const fullPath = path.join(projectRoot, row.file_path);
      if (!fs.existsSync(fullPath)) {
        db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(row.id);
        if (table === 'characters') {
          db.prepare(`DELETE FROM character_knowledge WHERE character_id = ?`).run(row.id);
        }
        removed++;
      }
    }
  }

  return removed;
}
