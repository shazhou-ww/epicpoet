import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import matter from 'gray-matter';
import Table from 'cli-table3';
import { findProjectRoot } from '../db/sync';
import { Chapter } from '../models/types';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function registerChapterCommand(program: Command): void {
  const chapter = program
    .command('chapter')
    .description('Manage chapters');

  chapter
    .command('create')
    .description('Create a new chapter')
    .requiredOption('--name <name>', 'Chapter title')
    .requiredOption('--scenes <ids>', 'Comma-separated scene ids (e.g. scn-001,scn-003,scn-002)')
    .action((options: { name: string; scenes: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const chaptersDir = path.join(projectRoot, 'chapters');

        if (!fs.existsSync(chaptersDir)) {
          fs.mkdirSync(chaptersDir, { recursive: true });
        }

        const existingFiles = fs.readdirSync(chaptersDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
        const number = existingFiles.length + 1;
        const seqNum = String(number).padStart(2, '0');
        const slug = slugify(options.name);
        const chapterId = `ch-${seqNum}-${slug}`;

        const sceneIds = options.scenes.split(',').map(s => s.trim()).filter(s => s.length > 0);

        const scenesDir = path.join(projectRoot, 'scenes');
        for (const sceneId of sceneIds) {
          const sceneFile = path.join(scenesDir, `${sceneId}.md`);
          if (!fs.existsSync(sceneFile)) {
            console.log(chalk.yellow(`Warning: scene file scenes/${sceneId}.md not found`));
          }
        }

        const chapterData: Chapter = {
          id: chapterId,
          title: options.name,
          number,
          summary: '',
          scenes: sceneIds,
          status: 'draft',
          created_at: new Date().toISOString(),
        };

        const filePath = path.join(chaptersDir, `${chapterId}.yaml`);
        fs.writeFileSync(filePath, YAML.stringify(chapterData), 'utf-8');

        console.log(chalk.green(`\n✓ Chapter "${options.name}" created at chapters/${chapterId}.yaml`));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  chapter
    .command('list')
    .description('List all chapters')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const chaptersDir = path.join(projectRoot, 'chapters');

        if (!fs.existsSync(chaptersDir)) {
          console.log(chalk.yellow('No chapters directory found.'));
          return;
        }

        const files = fs.readdirSync(chaptersDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

        if (files.length === 0) {
          console.log(chalk.yellow('No chapters found.'));
          return;
        }

        const chapters: Chapter[] = files.map(f => {
          const content = fs.readFileSync(path.join(chaptersDir, f), 'utf-8');
          return YAML.parse(content) as Chapter;
        });

        chapters.sort((a, b) => a.number - b.number);

        const table = new Table({
          head: ['#', 'ID', 'Title', 'Scenes', 'Status'],
          style: { head: ['cyan'] },
        });

        for (const ch of chapters) {
          table.push([
            String(ch.number),
            ch.id,
            ch.title,
            (ch.scenes || []).join(', '),
            ch.status,
          ]);
        }

        console.log(table.toString());
        console.log(chalk.green(`\n${chapters.length} chapter(s) found.`));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  chapter
    .command('show <chapterId>')
    .description('Show chapter content by assembling its scenes')
    .action((chapterId: string) => {
      try {
        const projectRoot = findProjectRoot();
        const chaptersDir = path.join(projectRoot, 'chapters');

        let chapterData: Chapter | null = null;

        const directPath = path.join(chaptersDir, `${chapterId}.yaml`);
        if (fs.existsSync(directPath)) {
          chapterData = YAML.parse(fs.readFileSync(directPath, 'utf-8')) as Chapter;
        } else if (fs.existsSync(chaptersDir)) {
          const files = fs.readdirSync(chaptersDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
          for (const f of files) {
            const parsed = YAML.parse(fs.readFileSync(path.join(chaptersDir, f), 'utf-8')) as Chapter;
            if (parsed.id === chapterId) {
              chapterData = parsed;
              break;
            }
          }
        }

        if (!chapterData) {
          console.error(chalk.red(`Error: chapter "${chapterId}" not found.`));
          process.exit(1);
        }

        console.log(chalk.bold.underline(`\n${chapterData.title} (${chapterData.id})\n`));

        const scenesDir = path.join(projectRoot, 'scenes');
        for (const sceneId of chapterData.scenes || []) {
          const sceneFile = path.join(scenesDir, `${sceneId}.md`);
          if (!fs.existsSync(sceneFile)) {
            console.log(chalk.yellow(`Warning: scene file scenes/${sceneId}.md not found, skipping.`));
            continue;
          }

          const raw = fs.readFileSync(sceneFile, 'utf-8');
          const { data, content } = matter(raw);
          const sceneTitle = (data as Record<string, unknown>).title as string || sceneId;

          console.log(chalk.cyan(`--- Scene: ${sceneTitle} ---`));
          console.log(content.trim());
          console.log();
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}
