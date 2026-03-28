import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { initDatabase } from '../db/schema';
import { findProjectRoot } from '../db/sync';
import { Universe } from '../models/types';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show project overview')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const universePath = path.join(projectRoot, 'universe.yaml');
        const universeContent = fs.readFileSync(universePath, 'utf-8');
        const universe = YAML.parse(universeContent) as Universe;

        const dbPath = path.join(projectRoot, '.epicpoet', 'index.sqlite');
        const db = initDatabase(dbPath);

        const count = (table: string): number => {
          const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
          return row.c;
        };

        const characters = count('characters');
        const events = count('events');
        const scenes = count('scenes');
        const chapters = count('chapters');
        const locations = count('locations');
        const concepts = count('concepts');
        const items = count('items');

        const wordRow = db.prepare('SELECT COALESCE(SUM(word_count), 0) as total FROM scenes').get() as { total: number };
        const totalWords = wordRow.total;

        const syncRow = db.prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'").get() as { value: string } | undefined;
        const lastSync = syncRow ? syncRow.value : 'Never';

        db.close();

        console.log(chalk.bold.cyan(`\n📖 ${universe.name}`));
        if (universe.description) {
          console.log(chalk.gray(`   ${universe.description}`));
        }
        console.log();

        const table = new Table({
          style: { head: ['cyan'] },
        });

        table.push(
          { 'Characters': String(characters) },
          { 'Events': String(events) },
          { 'Scenes': String(scenes) },
          { 'Chapters': String(chapters) },
          { 'Locations': String(locations) },
          { 'Concepts': String(concepts) },
          { 'Items': String(items) },
          { 'Total Words': String(totalWords) },
        );

        console.log(table.toString());
        console.log(chalk.gray(`\nLast sync: ${lastSync}`));
        console.log(chalk.gray(`Time system: ${universe.time_system.type}`));
        console.log(chalk.gray(`Style: ${universe.style.tone} (${universe.style.language})`));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}
