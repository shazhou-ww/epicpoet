import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { findProjectRoot } from '../db/sync';

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

async function deleteEntity(type: string, name: string, force: boolean): Promise<void> {
  const normalized = normalizationType(type);
  const dirName = getTypeDir(normalized);

  if (!dirName) {
    console.error(chalk.red(`Unknown type: ${type}`));
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

  if (!force) {
    const { confirm } = await inquirer.prompt([
      { type: 'confirm', name: 'confirm', message: `Delete ${normalized} "${name}" (${path.basename(filePath)})?`, default: false },
    ]);
    if (!confirm) {
      console.log(chalk.yellow('Cancelled.'));
      return;
    }
  }

  fs.unlinkSync(filePath);
  console.log(chalk.green(`✓ Deleted ${normalized} "${name}" (${path.basename(filePath)})`));
}

export function registerDeleteCommand(program: Command): void {
  program
    .command('delete <type> <name>')
    .description('Delete an entity')
    .option('--force', 'Skip confirmation prompt')
    .action(async (type: string, name: string, opts: { force?: boolean }) => {
      try {
        await deleteEntity(type, name, opts.force || false);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}
