import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { Character, Event, LearnRecord, Location } from '../models/types';
import { findProjectRoot } from '../db/sync';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

  const slug = slugify(answers.name);

  const character: Character = {
    id: slug,
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

  const filePath = path.join(charsDir, `${slug}.yaml`);
  fs.writeFileSync(filePath, YAML.stringify(character), 'utf-8');

  console.log(chalk.green(`\n✓ Character "${answers.name}" created at characters/${slug}.yaml`));
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
  const slug = slugify(answers.title);
  const eventId = `evt-${seqNum}-${slug}`;

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
    for (const charId of participants) {
      const charFile = path.join(charsDir, `${charId}.yaml`);
      if (fs.existsSync(charFile)) {
        const charContent = fs.readFileSync(charFile, 'utf-8');
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
        fs.writeFileSync(charFile, YAML.stringify(charData), 'utf-8');
        console.log(chalk.cyan(`  Added learn entry to ${charId}`));
      } else {
        console.log(chalk.yellow(`  Warning: character file not found for "${charId}"`));
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

  const slug = slugify(answers.name);

  let targetDir: string;
  let filePath: string;

  if (answers.parent) {
    targetDir = path.join(locsDir, answers.parent);
    filePath = path.join(targetDir, `${slug}.yaml`);
  } else {
    targetDir = locsDir;
    filePath = path.join(locsDir, `${slug}.yaml`);
  }

  const location: Location = {
    id: slug,
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
    ? `locations/${answers.parent}/${slug}.yaml`
    : `locations/${slug}.yaml`;
  console.log(chalk.green(`\n✓ Location "${answers.name}" created at ${relativePath}`));
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
    .action(() => {
      console.log('Add concept - to be implemented');
    });

  add
    .command('item')
    .description('Add a new item')
    .action(() => {
      console.log('Add item - to be implemented');
    });
}
