import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import path from 'path';
import { initDatabase } from '../db/schema';
import { findProjectRoot } from '../db/sync';

interface KnowledgeRow {
  id: string;
  title: string;
  description: string;
  epoch: number;
  know_method: string;
  know_at: number;
  notes: string | null;
}

export function registerQueryCommand(program: Command): void {
  const query = program
    .command('query')
    .description('Query worldbuilding data');

  query
    .command('knowledge <character>')
    .description('Query what a character knows at a given time')
    .requiredOption('--at <epoch>', 'Epoch time to query at')
    .action((character: string, options: { at: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const dbPath = path.join(projectRoot, '.epicpoet', 'index.sqlite');
        const db = initDatabase(dbPath);
        const T = parseInt(options.at, 10);

        if (isNaN(T)) {
          console.error(chalk.red('Error: --at must be a valid number'));
          process.exit(1);
        }

        const charRow = db.prepare('SELECT id, name FROM characters WHERE id = ?').get(character) as { id: string; name: string } | undefined;
        if (!charRow) {
          console.error(chalk.red(`Error: character "${character}" not found. Run 'epicpoet sync' first.`));
          db.close();
          process.exit(1);
        }

        const sql = `
          SELECT e.id, e.title, e.description, e.epoch, 'public' as know_method, e.epoch as know_at, NULL as notes
          FROM events e
          WHERE e.visibility = 'public' AND e.epoch <= :T

          UNION

          SELECT e.id, e.title, e.description, e.epoch, 'witnessed' as know_method, e.epoch as know_at, NULL as notes
          FROM events e, json_each(e.participants) je
          WHERE je.value = :character_id AND e.epoch <= :T

          UNION

          SELECT e.id, e.title, e.description, e.epoch, ck.method as know_method, ck.at_epoch as know_at, ck.notes as notes
          FROM events e
          JOIN character_knowledge ck ON ck.event_id = e.id
          WHERE ck.character_id = :character_id AND ck.at_epoch <= :T

          ORDER BY know_at
        `;

        const rows = db.prepare(sql).all({
          T,
          character_id: character,
        }) as KnowledgeRow[];

        const deduped = new Map<string, KnowledgeRow>();
        const methodPriority: Record<string, number> = {
          public: 0,
          witnessed: 1,
          told_by: 2,
          discovered: 2,
          rumor: 2,
          letter: 2,
        };

        for (const row of rows) {
          const existing = deduped.get(row.id);
          if (!existing) {
            deduped.set(row.id, row);
          } else {
            const existingPriority = methodPriority[existing.know_method] ?? 1;
            const newPriority = methodPriority[row.know_method] ?? 1;
            if (newPriority > existingPriority) {
              deduped.set(row.id, row);
            }
          }
        }

        const results = Array.from(deduped.values()).sort((a, b) => a.epoch - b.epoch);

        const table = new Table({
          head: ['Event Title', 'Epoch', 'How Known', 'Notes'],
          style: { head: ['cyan'] },
        });

        for (const r of results) {
          table.push([r.title, String(r.epoch), r.know_method, r.notes || '']);
        }

        console.log(table.toString());
        console.log(chalk.green(`\n${charRow.name} knows ${results.length} events at epoch ${T}`));

        db.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  query
    .command('timeline')
    .description('View event timeline')
    .option('--character <name>', 'Filter by character')
    .option('--from <epoch>', 'Start epoch')
    .option('--to <epoch>', 'End epoch')
    .action((options) => {
      console.log('Query timeline - to be implemented');
    });
}
