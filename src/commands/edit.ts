import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { findProjectRoot } from '../db/sync';
import { sanitizeFilename } from '../utils/filename';

const TYPE_DIR_MAP: Record<string, string> = {
  character: 'characters',
  event: 'events',
  location: 'locations',
  concept: 'concepts',
  item: 'items',
  scene: 'scenes',
  chapter: 'chapters',
};

const PLURAL_TO_SINGULAR: Record<string, string> = {
  characters: 'character',
  events: 'event',
  locations: 'location',
  concepts: 'concept',
  items: 'item',
  scenes: 'scene',
  chapters: 'chapter',
};

function normalizationType(type: string): string {
  const lower = type.toLowerCase();
  if (TYPE_DIR_MAP[lower]) return lower;
  if (PLURAL_TO_SINGULAR[lower]) return PLURAL_TO_SINGULAR[lower];
  return lower;
}

function getTypeDir(type: string): string | null {
  return TYPE_DIR_MAP[type] || null;
}

function collectFilesRecursive(dir: string, exts: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursive(fullPath, exts));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function collectFiles(dir: string, exts: string[], recursive: boolean): string[] {
  if (recursive) return collectFilesRecursive(dir, exts);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => exts.some(ext => f.endsWith(ext)))
    .map(f => path.join(dir, f));
}

function basenameNoExt(filePath: string): string {
  const base = path.basename(filePath);
  const dotIndex = base.indexOf('.');
  return dotIndex === -1 ? base : base.substring(0, dotIndex);
}

function findFile(dir: string, name: string, recursive: boolean): string | null {
  const exts = ['.yaml', '.yml', '.md'];
  const files = collectFiles(dir, exts, recursive);

  const exactMatch = files.find(
    f => basenameNoExt(f).toLowerCase() === name.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  const fuzzyMatches = files.filter(
    f => basenameNoExt(f).toLowerCase().includes(name.toLowerCase())
  );

  if (fuzzyMatches.length === 1) return fuzzyMatches[0];

  if (fuzzyMatches.length > 1) {
    console.log(chalk.yellow(`Multiple matches found for "${name}":`));
    for (const f of fuzzyMatches) {
      console.log(chalk.yellow(`  - ${basenameNoExt(f)}`));
    }
    console.log(chalk.yellow('Please be more specific.'));
    return null;
  }

  return null;
}

async function editEntity(type: string, name: string, options: Record<string, string>): Promise<void> {
  const normalized = normalizationType(type);
  const dirName = getTypeDir(normalized);

  if (!dirName) {
    console.error(chalk.red(`Unknown type: ${type}`));
    console.error(chalk.red(`Supported types: character, event, location, concept, item`));
    process.exit(1);
  }

  const projectRoot = findProjectRoot();
  const dir = path.join(projectRoot, dirName);

  if (!fs.existsSync(dir)) {
    console.error(chalk.red(`Directory not found: ${dirName}/`));
    process.exit(1);
  }

  const recursive = normalized === 'location';
  const filePath = findFile(dir, name, recursive);

  if (!filePath) {
    console.error(chalk.red(`No ${normalized} found matching "${name}"`));
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const data = YAML.parse(content) as Record<string, unknown>;

  if (options.description !== undefined) data.description = options.description;

  if (normalized === 'character') {
    if (options.traits !== undefined) data.traits = options.traits.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (options.backstory !== undefined) data.backstory = options.backstory;
    if (options.status !== undefined) data.status = options.status;
  } else if (normalized === 'event') {
    if (options.time !== undefined) data.epoch = Number(options.time);
    if (options.location !== undefined) data.location = options.location;
    if (options.participants !== undefined) data.participants = options.participants.split(',').map(p => p.trim()).filter(p => p.length > 0);
    if (options.visibility !== undefined) data.visibility = options.visibility;
  } else if (normalized === 'location') {
    if (options.parent !== undefined) data.parent = options.parent;
  } else if (normalized === 'concept') {
    if (options.category !== undefined) data.category = options.category;
  } else if (normalized === 'item') {
    if (options.owner !== undefined) data.owner = options.owner;
  }

  data.updated_at = new Date().toISOString();

  let finalPath = filePath;
  if (options.name !== undefined && options.name !== data.name) {
    const newName = options.name;
    const newSafeName = sanitizeFilename(newName);
    const newFilePath = path.join(path.dirname(filePath), `${newSafeName}.yaml`);

    data.id = newName;
    data.name = newName;
    if (normalized === 'event') data.title = newName;

    fs.writeFileSync(newFilePath, YAML.stringify(data), 'utf-8');
    fs.unlinkSync(filePath);
    finalPath = newFilePath;
    console.log(chalk.green(`✓ ${normalized} renamed and updated: ${path.basename(finalPath)}`));
  } else {
    fs.writeFileSync(filePath, YAML.stringify(data), 'utf-8');
    console.log(chalk.green(`✓ ${normalized} "${data.name || data.title || name}" updated`));
  }
}

export function registerEditCommand(program: Command): void {
  program
    .command('edit <type> <name>')
    .description('Edit an existing entity')
    .option('--name <newName>', 'Rename the entity')
    .option('--description <text>', 'Update description')
    .option('--traits <traits>', 'Update traits (character, comma-separated)')
    .option('--backstory <text>', 'Update backstory (character)')
    .option('--status <status>', 'Update status (character)')
    .option('--time <epoch>', 'Update epoch (event)')
    .option('--location <id>', 'Update location (event)')
    .option('--participants <ids>', 'Update participants (event, comma-separated)')
    .option('--visibility <level>', 'Update visibility (event)')
    .option('--parent <parentId>', 'Update parent (location)')
    .option('--category <category>', 'Update category (concept)')
    .option('--owner <owner>', 'Update owner (item)')
    .action(async (type: string, name: string, opts: Record<string, string>) => {
      try {
        await editEntity(type, name, opts);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}
