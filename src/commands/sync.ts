import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { initDatabase } from '../db/schema';
import { SCHEMA, INDEXES } from '../db/schema';
import {
  findProjectRoot,
  syncCharacters,
  syncEvents,
  syncScenes,
  syncChapters,
  syncLocations,
  syncConcepts,
  syncItems,
  cleanupStale,
} from '../db/sync';
import path from 'path';

export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync files to SQLite index')
    .option('--force', 'Force full rebuild')
    .action((options) => {
      try {
        const projectRoot = findProjectRoot();
        const dbPath = path.join(projectRoot, '.epicpoet', 'index.sqlite');
        const db = initDatabase(dbPath);

        if (options.force) {
          const tables = [
            'character_knowledge', 'scenes', 'chapters',
            'events', 'characters', 'locations', 'concepts', 'items', 'sync_meta',
          ];
          for (const table of tables) {
            db.exec(`DELETE FROM ${table}`);
          }
          console.log(chalk.yellow('Force rebuild: cleared all data.'));
        }

        const evts = syncEvents(db, projectRoot);
        const chars = syncCharacters(db, projectRoot);
        const scns = syncScenes(db, projectRoot);
        const chps = syncChapters(db, projectRoot);
        const locs = syncLocations(db, projectRoot);
        const cons = syncConcepts(db, projectRoot);
        const itms = syncItems(db, projectRoot);
        const removed = cleanupStale(db, projectRoot);

        db.prepare(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_sync', ?)`)
          .run(new Date().toISOString());

        try {
          const gitHead = execSync('git rev-parse HEAD', { cwd: projectRoot }).toString().trim();
          db.prepare(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('index.version', ?)`)
            .run(gitHead);
        } catch {
          // Not in a git repo or git not available
        }

        db.close();

        console.log(chalk.green('\n✓ Sync complete!'));
        console.log(`  Synced: ${evts} events, ${chars} characters, ${scns} scenes, ${chps} chapters, ${locs} locations, ${cons} concepts, ${itms} items`);
        if (removed > 0) {
          console.log(chalk.yellow(`  Removed ${removed} stale entries.`));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}
