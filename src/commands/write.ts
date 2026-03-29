import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import matter from 'gray-matter';
import { initDatabase } from '../db/schema';
import { findProjectRoot } from '../db/sync';
import { SceneFrontmatter } from '../models/types';
import { sanitizeFilename } from '../utils/filename';

interface WriteOptions {
  time?: string;
  location?: string;
  pov?: string;
  participants?: string;
  synopsis?: string;
  style?: string;
  promptFile?: string;
  output?: string;
}

interface KnownEvent {
  id: string;
  title: string;
  description: string;
  epoch: number;
  know_method: string;
  know_at: number;
  notes: string | null;
}

interface CharacterRow {
  id: string;
  name: string;
  description: string;
  traits: string;
}

interface LocationRow {
  id: string;
  name: string;
  description: string;
}

interface EventRow {
  id: string;
  title: string;
  description: string;
  epoch: number;
}

interface UniverseData {
  name: string;
  description: string;
  style: {
    default_pov: string;
    tone: string;
    language: string;
  };
}

export function registerWriteCommand(program: Command): void {
  program
    .command('write')
    .description('Generate a scene skeleton and AI writing prompt')
    .requiredOption('--time <epoch>', 'Narrative time epoch')
    .requiredOption('--pov <character>', 'POV character id or "narrator"')
    .option('--location <id>', 'Location id')
    .option('--participants <ids>', 'Comma-separated character ids')
    .option('--synopsis <text>', 'Scene synopsis/direction')
    .option('--style <text>', 'Writing style requirements')
    .option('--prompt-file <path>', 'Output prompt to file instead of stdout')
    .option('--output <path>', 'Output scene file path, or auto-generate')
    .action(async (options: WriteOptions) => {
      let db;
      try {
        // (a) Validate
        const T = parseInt(options.time!, 10);
        if (isNaN(T)) {
          console.error(chalk.red('Error: --time must be a valid number'));
          process.exit(1);
        }

        // (b) Open DB and read universe.yaml
        const projectRoot = findProjectRoot();
        const dbPath = path.join(projectRoot, '.epicpoet', 'index.sqlite');
        db = initDatabase(dbPath);

        const universeRaw = fs.readFileSync(path.join(projectRoot, 'universe.yaml'), 'utf-8');
        const universe = YAML.parse(universeRaw) as UniverseData;

        // (c) Get POV character info
        let povCharacter: CharacterRow | null = null;
        if (options.pov !== 'narrator') {
          const row = db.prepare('SELECT id, name, description, traits FROM characters WHERE id = ? OR name = ?').get(options.pov, options.pov) as CharacterRow | undefined;
          if (!row) {
            console.error(chalk.red(`Error: POV character "${options.pov}" not found. Run 'epicpoet sync' first.`));
            db.close();
            process.exit(1);
          }
          povCharacter = row;
        }

        // (d) Get participant characters
        const participantIds = options.participants
          ? options.participants.split(',').map(s => s.trim()).filter(s => s.length > 0)
          : [];
        const participantCharacters: CharacterRow[] = [];
        for (const pid of participantIds) {
          const row = db.prepare('SELECT id, name, description, traits FROM characters WHERE id = ? OR name = ?').get(pid, pid) as CharacterRow | undefined;
          if (row) {
            participantCharacters.push(row);
          } else {
            console.log(chalk.yellow(`Warning: participant "${pid}" not found in database`));
          }
        }

        // (e) Get location info
        let locationInfo: LocationRow | null = null;
        if (options.location) {
          const row = db.prepare('SELECT id, name, description FROM locations WHERE id = ? OR name = ?').get(options.location, options.location) as LocationRow | undefined;
          if (row) {
            locationInfo = row;
          } else {
            console.log(chalk.yellow(`Warning: location "${options.location}" not found in database`));
          }
        }

        // (f) Query known events for POV
        let knownEvents: KnownEvent[];
        if (options.pov === 'narrator') {
          const rows = db.prepare(
            'SELECT id, title, description, epoch, \'narrator\' as know_method, epoch as know_at, NULL as notes FROM events WHERE epoch <= ? ORDER BY epoch'
          ).all(T) as KnownEvent[];
          knownEvents = rows;
        } else {
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
          const rows = db.prepare(sql).all({ T, character_id: options.pov }) as KnownEvent[];

          const deduped = new Map<string, KnownEvent>();
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

          knownEvents = Array.from(deduped.values()).sort((a, b) => a.epoch - b.epoch);
        }

        // (g) Query unknown events (only if not narrator)
        let unknownEvents: EventRow[] = [];
        if (options.pov !== 'narrator') {
          const knownIds = knownEvents.map(e => e.id);
          const allEvents = db.prepare(
            'SELECT id, title, description, epoch FROM events WHERE epoch <= ? ORDER BY epoch'
          ).all(T) as EventRow[];
          const knownIdSet = new Set(knownIds);
          unknownEvents = allEvents.filter(e => !knownIdSet.has(e.id));
        }

        // (h) Print known events summary
        console.log(chalk.cyan('=== POV Character Known Events ==='));
        for (const evt of knownEvents) {
          console.log(`  - [${evt.epoch}] ${evt.title} (how: ${evt.know_method})`);
        }

        if (unknownEvents.length > 0) {
          console.log(chalk.yellow('=== Events UNKNOWN to POV ==='));
          for (const evt of unknownEvents) {
            console.log(`  - [${evt.epoch}] ${evt.title}`);
          }
        }

        // (i) Build AI prompt
        const povSection = povCharacter
          ? `Name: ${povCharacter.name}\nDescription: ${povCharacter.description}\nTraits: ${povCharacter.traits}`
          : 'Narrator (omniscient viewpoint)';

        const locationSection = locationInfo
          ? `Name: ${locationInfo.name}\nDescription: ${locationInfo.description}`
          : 'Not specified';

        const participantsSection = participantCharacters.length > 0
          ? participantCharacters.map(c => `- Name: ${c.name}\n  Description: ${c.description}\n  Traits: ${c.traits}`).join('\n')
          : 'None specified';

        const knownEventsSection = knownEvents.length > 0
          ? knownEvents.map(e => `- [${e.epoch}] ${e.title}: ${e.description} (known via: ${e.know_method})`).join('\n')
          : 'No known events';

        let unknownEventsSection: string;
        if (options.pov === 'narrator') {
          unknownEventsSection = 'Narrator knows all events listed above.';
        } else if (unknownEvents.length > 0) {
          unknownEventsSection = unknownEvents.map(e => `- [${e.epoch}] ${e.title}: ${e.description}`).join('\n');
        } else {
          unknownEventsSection = 'No unknown events';
        }

        const styleSection = [
          `Default POV: ${universe.style.default_pov}`,
          `Tone: ${universe.style.tone}`,
          `Language: ${universe.style.language}`,
        ];
        if (options.style) {
          styleSection.push(`Additional Style Requirements: ${options.style}`);
        }

        const povName = povCharacter ? povCharacter.name : 'an omniscient narrator';
        const locName = locationInfo ? locationInfo.name : 'unspecified location';

        const prompt = [
          '# AI Writing Prompt',
          '',
          '## Universe',
          `Name: ${universe.name}`,
          `Description: ${universe.description}`,
          '',
          '## Writing Style',
          ...styleSection,
          '',
          '## POV Character',
          povSection,
          '',
          '## Location',
          locationSection,
          '',
          '## Participating Characters',
          participantsSection,
          '',
          '## Events Known to POV',
          knownEventsSection,
          '',
          '## Events UNKNOWN to POV (DO NOT reveal in narrative)',
          unknownEventsSection,
          '',
          '## Synopsis / Direction',
          options.synopsis || 'No synopsis provided',
          '',
          '## Instructions',
          `Write a scene from the perspective of ${povName}.`,
          `The scene takes place at epoch ${T}, at location ${locName}.`,
          `The POV character can ONLY know and reference events listed in 'Events Known to POV'.`,
          `DO NOT let the POV character know, reference, or hint at events in 'Events UNKNOWN to POV'.`,
          'Follow the synopsis direction provided.',
        ].join('\n');

        // (j) Output prompt
        if (options.promptFile) {
          const promptDir = path.dirname(path.resolve(options.promptFile));
          if (!fs.existsSync(promptDir)) {
            fs.mkdirSync(promptDir, { recursive: true });
          }
          fs.writeFileSync(options.promptFile, prompt, 'utf-8');
        } else {
          console.log('\n' + prompt);
        }

        // (k) Generate scene file
        const scenesDir = path.join(projectRoot, 'scenes');
        if (!fs.existsSync(scenesDir)) {
          fs.mkdirSync(scenesDir, { recursive: true });
        }

        const existingMdFiles = fs.readdirSync(scenesDir).filter(f => f.endsWith('.md'));
        const seqNum = String(existingMdFiles.length + 1).padStart(3, '0');
        const sceneId = 'scn-' + seqNum + '-' + sanitizeFilename(options.synopsis || 'untitled');

        const sceneFilePath = options.output
          ? options.output
          : path.join(scenesDir, `${sceneId}.md`);

        const frontmatter: SceneFrontmatter = {
          id: sceneId,
          title: options.synopsis ? options.synopsis.substring(0, 50) : 'Untitled Scene',
          event: '',
          epoch: T,
          location: options.location || '',
          pov: options.pov!,
          characters: participantIds,
          summary: options.synopsis || '',
          word_count: 0,
          status: 'draft',
          created_at: new Date().toISOString(),
        };

        const sceneContent = matter.stringify(
          '<!-- AI-generated content goes here -->\n\n',
          frontmatter,
        );

        const outputDir = path.dirname(path.resolve(sceneFilePath));
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(sceneFilePath, sceneContent, 'utf-8');

        // (l) Print success
        console.log(chalk.green('Scene skeleton: ' + sceneFilePath));
        if (options.promptFile) {
          console.log(chalk.green('AI prompt: ' + options.promptFile));
        }

        // (m) Close DB
        db.close();
      } catch (err: unknown) {
        if (db) {
          try { db.close(); } catch { /* ignore */ }
        }
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}
