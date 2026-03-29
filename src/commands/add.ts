import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { Character, Concept, Event, Item, LearnRecord, Location } from '../models/types';
import { findProjectRoot } from '../db/sync';
import { sanitizeFilename } from '../utils/filename';

function resolveCharacterFile(charsDir: string, participant: string): string | null {
  const directFile = path.join(charsDir, `${sanitizeFilename(participant)}.yaml`);
  if (fs.existsSync(directFile)) return directFile;

  if (!fs.existsSync(charsDir)) return null;
  const yamlFiles = fs.readdirSync(charsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  for (const file of yamlFiles) {
    const filePath = path.join(charsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = YAML.parse(content) as Character;
    if (data.name === participant) return filePath;
    if (data.aliases && data.aliases.includes(participant)) return filePath;
  }

  return null;
}

interface CharacterOptions {
  name?: string;
  description?: string;
  traits?: string;
  backstory?: string;
  status?: string;
}

async function addCharacter(options: CharacterOptions): Promise<void> {
  const projectRoot = findProjectRoot();
  const charsDir = path.join(projectRoot, 'characters');

  let answers: { name: string; description: string; traits: string; backstory: string; status: string };

  if (options.name) {
    answers = {
      name: options.name,
      description: options.description || '',
      traits: options.traits || '',
      backstory: options.backstory || '',
      status: (options.status || 'alive') as 'alive' | 'dead' | 'unknown',
    };
  } else {
    answers = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'Character name:', validate: (v: string) => v.trim().length > 0 || 'Name is required' },
      { type: 'input', name: 'description', message: 'Description:', default: '' },
      { type: 'input', name: 'traits', message: 'Traits (comma-separated):', default: '' },
      { type: 'input', name: 'backstory', message: 'Backstory:', default: '' },
      { type: 'list', name: 'status', message: 'Status:', choices: ['alive', 'dead', 'unknown'], default: 'alive' },
    ]);
  }

  const safeName = sanitizeFilename(answers.name);

  const character: Character = {
    id: answers.name,
    name: answers.name,
    aliases: [],
    description: answers.description,
    traits: answers.traits ? answers.traits.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [],
    backstory: answers.backstory,
    affiliations: [],
    relationships: [],
    learns: [],
    status: answers.status as 'alive' | 'dead' | 'unknown',
    first_appearance_epoch: 0,
    created_at: new Date().toISOString(),
  };

  if (!fs.existsSync(charsDir)) {
    fs.mkdirSync(charsDir, { recursive: true });
  }

  const filePath = path.join(charsDir, `${safeName}.yaml`);
  fs.writeFileSync(filePath, YAML.stringify(character), 'utf-8');

  console.log(chalk.green(`\n✓ Character "${answers.name}" created at characters/${safeName}.yaml`));
}

interface EventOptions {
  name?: string;
  time?: string;
  location?: string;
  participants?: string;
  visibility?: string;
  description?: string;
}

async function addEvent(options: EventOptions): Promise<void> {
  const projectRoot = findProjectRoot();
  const eventsDir = path.join(projectRoot, 'events');

  let answers: { title: string; description: string; epoch: number; location: string; visibility: string; participants: string };

  if (options.name) {
    answers = {
      title: options.name,
      description: options.description || '',
      epoch: options.time ? Number(options.time) : 0,
      location: options.location || '',
      visibility: (options.visibility || 'participants') as 'public' | 'participants' | 'secret',
      participants: options.participants || '',
    };
  } else {
    answers = await inquirer.prompt([
      { type: 'input', name: 'title', message: 'Event title:', validate: (v: string) => v.trim().length > 0 || 'Title is required' },
      { type: 'input', name: 'description', message: 'Description:', default: '' },
      { type: 'number', name: 'epoch', message: 'Epoch (when it happened):', default: 0 },
      { type: 'input', name: 'location', message: 'Location id:', default: '' },
      { type: 'list', name: 'visibility', message: 'Visibility:', choices: ['public', 'participants', 'secret'], default: 'participants' },
      { type: 'input', name: 'participants', message: 'Participants (comma-separated character ids):', default: '' },
    ]);
  }

  if (!fs.existsSync(eventsDir)) {
    fs.mkdirSync(eventsDir, { recursive: true });
  }

  const existingFiles = fs.existsSync(eventsDir)
    ? fs.readdirSync(eventsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    : [];
  const seqNum = String(existingFiles.length + 1).padStart(3, '0');
  const safeTitle = sanitizeFilename(answers.title);
  const eventId = `evt-${seqNum}-${safeTitle}`;

  const participants = answers.participants
    ? answers.participants.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
    : [];

  const event: Event = {
    id: eventId,
    title: answers.title,
    description: answers.description,
    epoch: answers.epoch,
    location: answers.location,
    participants,
    visibility: answers.visibility as 'public' | 'participants' | 'secret',
    tags: [],
    created_at: new Date().toISOString(),
  };

  const filePath = path.join(eventsDir, `${eventId}.yaml`);
  fs.writeFileSync(filePath, YAML.stringify(event), 'utf-8');

  if (answers.visibility === 'participants' && participants.length > 0) {
    const charsDir = path.join(projectRoot, 'characters');
    for (const participant of participants) {
      const resolved = resolveCharacterFile(charsDir, participant);
      if (resolved) {
        const charContent = fs.readFileSync(resolved, 'utf-8');
        const charData = YAML.parse(charContent) as Character;
        if (!charData.learns) {
          charData.learns = [];
        }
        const learnEntry: LearnRecord = {
          event: eventId,
          at_epoch: answers.epoch,
          method: 'witnessed',
        };
        charData.learns.push(learnEntry);
        fs.writeFileSync(resolved, YAML.stringify(charData), 'utf-8');
        console.log(chalk.cyan(`  Added learn entry to ${charData.id}`));
      } else {
        console.log(chalk.yellow(`  Warning: character file not found for "${participant}"`));
      }
    }
  }

  console.log(chalk.green(`\n✓ Event "${answers.title}" created at events/${eventId}.yaml`));
}

interface LocationOptions {
  name?: string;
  parent?: string;
  description?: string;
}

async function addLocation(options: LocationOptions): Promise<void> {
  const projectRoot = findProjectRoot();
  const locsDir = path.join(projectRoot, 'locations');

  let answers: { name: string; description: string; parent: string };

  if (options.name) {
    answers = {
      name: options.name,
      description: options.description || '',
      parent: options.parent || '',
    };
  } else {
    answers = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'Location name:', validate: (v: string) => v.trim().length > 0 || 'Name is required' },
      { type: 'input', name: 'description', message: 'Description:', default: '' },
      { type: 'input', name: 'parent', message: 'Parent location id (leave empty for top-level):', default: '' },
    ]);
  }

  const safeName = sanitizeFilename(answers.name);

  let targetDir: string;
  let filePath: string;

  if (answers.parent) {
    targetDir = path.join(locsDir, answers.parent);
    filePath = path.join(targetDir, `${safeName}.yaml`);
  } else {
    targetDir = locsDir;
    filePath = path.join(locsDir, `${safeName}.yaml`);
  }

  const location: Location = {
    id: answers.name,
    name: answers.name,
    description: answers.description,
    ...(answers.parent ? { parent: answers.parent } : {}),
    tags: [],
    created_at: new Date().toISOString(),
  };

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(filePath, YAML.stringify(location), 'utf-8');

  const relativePath = answers.parent
    ? `locations/${answers.parent}/${safeName}.yaml`
    : `locations/${safeName}.yaml`;
  console.log(chalk.green(`\n✓ Location "${answers.name}" created at ${relativePath}`));
}

interface ConceptOptions {
  name?: string;
  category?: string;
  description?: string;
}

async function addConcept(options: ConceptOptions): Promise<void> {
  const projectRoot = findProjectRoot();
  const conceptsDir = path.join(projectRoot, 'concepts');

  let answers: { name: string; category: string; description: string };

  if (options.name) {
    answers = {
      name: options.name,
      category: options.category || '',
      description: options.description || '',
    };
  } else {
    answers = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'Concept name:', validate: (v: string) => v.trim().length > 0 || 'Name is required' },
      { type: 'input', name: 'category', message: 'Category:', default: '' },
      { type: 'input', name: 'description', message: 'Description:', default: '' },
    ]);
  }

  const safeName = sanitizeFilename(answers.name);

  const concept: Concept = {
    id: answers.name,
    name: answers.name,
    category: answers.category,
    description: answers.description,
    tags: [],
    created_at: new Date().toISOString(),
  };

  if (!fs.existsSync(conceptsDir)) {
    fs.mkdirSync(conceptsDir, { recursive: true });
  }

  const filePath = path.join(conceptsDir, `${safeName}.yaml`);
  fs.writeFileSync(filePath, YAML.stringify(concept), 'utf-8');

  console.log(chalk.green(`\n✓ Concept "${answers.name}" created at concepts/${safeName}.yaml`));
}

interface ItemOptions {
  name?: string;
  description?: string;
  owner?: string;
}

async function addItem(options: ItemOptions): Promise<void> {
  const projectRoot = findProjectRoot();
  const itemsDir = path.join(projectRoot, 'items');

  let answers: { name: string; description: string; owner: string };

  if (options.name) {
    answers = {
      name: options.name,
      description: options.description || '',
      owner: options.owner || '',
    };
  } else {
    answers = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'Item name:', validate: (v: string) => v.trim().length > 0 || 'Name is required' },
      { type: 'input', name: 'description', message: 'Description:', default: '' },
      { type: 'input', name: 'owner', message: 'Owner (character id):', default: '' },
    ]);
  }

  const safeName = sanitizeFilename(answers.name);

  const item: Item = {
    id: answers.name,
    name: answers.name,
    description: answers.description,
    ...(answers.owner ? { owner: answers.owner } : {}),
    tags: [],
    created_at: new Date().toISOString(),
  };

  if (!fs.existsSync(itemsDir)) {
    fs.mkdirSync(itemsDir, { recursive: true });
  }

  const filePath = path.join(itemsDir, `${safeName}.yaml`);
  fs.writeFileSync(filePath, YAML.stringify(item), 'utf-8');

  console.log(chalk.green(`\n✓ Item "${answers.name}" created at items/${safeName}.yaml`));
}

export function registerAddCommand(program: Command): void {
  const add = program
    .command('add')
    .description('Add a new entity to the project');

  add
    .command('character')
    .description('Add a new character')
    .option('--name <name>', 'Character name (enables non-interactive mode)')
    .option('--description <desc>', 'Character description')
    .option('--traits <traits>', 'Comma-separated traits')
    .option('--backstory <text>', 'Character backstory')
    .option('--status <status>', 'Status: alive, dead, or unknown')
    .action(async (opts: CharacterOptions) => {
      try {
        await addCharacter(opts);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  add
    .command('event')
    .description('Add a new event')
    .option('--name <title>', 'Event title (enables non-interactive mode)')
    .option('--time <epoch>', 'Epoch when it happened')
    .option('--location <id>', 'Location id')
    .option('--participants <ids>', 'Comma-separated participant character ids')
    .option('--visibility <level>', 'Visibility: public, participants, or secret')
    .option('--description <desc>', 'Event description')
    .action(async (opts: EventOptions) => {
      try {
        await addEvent(opts);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  add
    .command('location')
    .description('Add a new location')
    .option('--name <name>', 'Location name (enables non-interactive mode)')
    .option('--parent <parentId>', 'Parent location id')
    .option('--description <desc>', 'Location description')
    .action(async (opts: LocationOptions) => {
      try {
        await addLocation(opts);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  add
    .command('concept')
    .description('Add a new concept')
    .option('--name <name>', 'Concept name (enables non-interactive mode)')
    .option('--category <category>', 'Concept category (e.g. 魔法体系)')
    .option('--description <desc>', 'Concept description')
    .action(async (opts: ConceptOptions) => {
      try {
        await addConcept(opts);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  add
    .command('item')
    .description('Add a new item')
    .option('--name <name>', 'Item name (enables non-interactive mode)')
    .option('--description <desc>', 'Item description')
    .option('--owner <owner>', 'Owner character id')
    .action(async (opts: ItemOptions) => {
      try {
        await addItem(opts);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}
