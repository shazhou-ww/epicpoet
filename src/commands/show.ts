import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
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

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map(v => `\n    - ${String(v)}`).join('');
  }
  if (typeof value === 'object') {
    return '\n' + YAML.stringify(value).split('\n')
      .filter(l => l.trim())
      .map(l => `    ${l}`)
      .join('\n');
  }
  return String(value);
}

function displayYamlData(data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    const formattedValue = formatValue(value);
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      console.log(`${chalk.cyan(key + ':')}${formattedValue}`);
    } else {
      console.log(`${chalk.cyan(key + ':')} ${chalk.white(formattedValue)}`);
    }
  }
}

async function showEntity(type: string, name: string): Promise<void> {
  const normalized = normalizationType(type);
  const dirName = getTypeDir(normalized);

  if (!dirName) {
    console.error(chalk.red(`Unknown type: ${type}`));
    console.error(chalk.red(`Supported types: ${Object.keys(TYPE_DIR_MAP).join(', ')}`));
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
    if (!fs.existsSync(dir)) return;
    const exts = ['.yaml', '.yml', '.md'];
    const files = collectFiles(dir, exts, recursive);
    const fuzzyMatches = files.filter(
      f => basenameNoExt(f).toLowerCase().includes(name.toLowerCase())
    );
    if (fuzzyMatches.length === 0) {
      console.error(chalk.red(`No ${normalized} found matching "${name}"`));
    }
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  if (filePath.endsWith('.md')) {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (fmMatch) {
      const frontmatter = YAML.parse(fmMatch[1]) as Record<string, unknown>;
      displayYamlData(frontmatter);
      console.log(chalk.gray('─'.repeat(40)));
      console.log(fmMatch[2]);
    } else {
      console.log(content);
    }
  } else {
    const data = YAML.parse(content) as Record<string, unknown>;
    displayYamlData(data);
  }
}

function extractField(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    if (data[key] && typeof data[key] === 'string') return data[key] as string;
  }
  return '';
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

async function listEntities(type: string): Promise<void> {
  const normalized = normalizationType(type);
  const dirName = getTypeDir(normalized);

  if (!dirName) {
    console.error(chalk.red(`Unknown type: ${type}`));
    console.error(chalk.red(`Supported types: ${Object.keys(TYPE_DIR_MAP).join(', ')}`));
    process.exit(1);
  }

  const projectRoot = findProjectRoot();
  const dir = path.join(projectRoot, dirName);

  if (!fs.existsSync(dir)) {
    console.log(chalk.yellow(`No ${dirName}/ directory found.`));
    return;
  }

  const recursive = normalized === 'location';
  const exts = ['.yaml', '.yml', '.md'];
  const files = collectFiles(dir, exts, recursive);

  if (files.length === 0) {
    console.log(chalk.yellow(`No ${normalized} entities found.`));
    return;
  }

  const rows: Array<{ name: string; description: string }> = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');

    if (filePath.endsWith('.md')) {
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const fm = YAML.parse(fmMatch[1]) as Record<string, unknown>;
        rows.push({
          name: extractField(fm, 'title', 'name', 'id') || basenameNoExt(filePath),
          description: extractField(fm, 'summary', 'description'),
        });
      } else {
        rows.push({ name: basenameNoExt(filePath), description: '' });
      }
    } else {
      const data = YAML.parse(content) as Record<string, unknown>;
      rows.push({
        name: extractField(data, 'name', 'title', 'id') || basenameNoExt(filePath),
        description: extractField(data, 'description', 'summary'),
      });
    }
  }

  const nameWidth = 30;
  console.log(chalk.bold('Name'.padEnd(nameWidth)) + chalk.bold('Description'));
  console.log('-'.repeat(nameWidth + 50));

  for (const row of rows) {
    const name = truncate(row.name, nameWidth - 2).padEnd(nameWidth);
    const desc = truncate(row.description, 50);
    console.log(name + desc);
  }
}

export function registerShowCommand(program: Command): void {
  program
    .command('show <type> <name>')
    .description('Show details of an entity')
    .action(async (type: string, name: string) => {
      try {
        await showEntity(type, name);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  program
    .command('list <type>')
    .description('List entities of a type')
    .action(async (type: string) => {
      try {
        await listEntities(type);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}
