import Database from 'better-sqlite3';

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
}

export function syncAll(db: Database.Database, projectRoot: string): SyncResult {
  console.log('syncAll - to be implemented');
  return { added: 0, updated: 0, removed: 0 };
}

export function syncFile(db: Database.Database, filePath: string): void {
  console.log(`syncFile ${filePath} - to be implemented`);
}
