import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { Universe, TimeUnit } from '../models/types';
import { initDatabase } from '../db/schema';

const DIRECTORIES = [
  'characters',
  'events',
  'scenes',
  'chapters',
  'locations',
  'concepts',
  'items',
  '.epicpoet',
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new novel project')
    .option('--name <name>', 'Universe name')
    .option('--time-system <type>', 'Time system type (real or fictional)')
    .action(async (options) => {
      try {
        const dirName = path.basename(process.cwd());

        const nameAnswer = options.name
          ? { name: options.name }
          : await inquirer.prompt([{
              type: 'input',
              name: 'name',
              message: 'Universe name:',
              default: dirName,
            }]);

        const descAnswer = await inquirer.prompt([{
          type: 'input',
          name: 'description',
          message: 'Description:',
          default: '',
        }]);

        const timeTypeAnswer = options.timeSystem
          ? { type: options.timeSystem }
          : await inquirer.prompt([{
              type: 'list',
              name: 'type',
              message: 'Time system type:',
              choices: ['real', 'fictional'],
            }]);

        let epochZeroLabel = '';
        let epochZeroDate: string | undefined;
        const units: TimeUnit[] = [];

        if (timeTypeAnswer.type === 'real') {
          epochZeroLabel = 'Unix Epoch (1970-01-01)';
          epochZeroDate = '1970-01-01T00:00:00Z';
        } else {
          const epochAnswer = await inquirer.prompt([{
            type: 'input',
            name: 'epoch_zero_label',
            message: 'Epoch zero label (human-readable name for epoch 0):',
            default: 'The Beginning',
          }]);
          epochZeroLabel = epochAnswer.epoch_zero_label;

          const addUnits = await inquirer.prompt([{
            type: 'confirm',
            name: 'add',
            message: 'Define custom time units?',
            default: true,
          }]);

          if (addUnits.add) {
            const defaultUnits = [
              { name: 'year', seconds: 31536000 },
              { name: 'month', seconds: 2592000 },
              { name: 'day', seconds: 86400 },
            ];

            for (const du of defaultUnits) {
              const unitAnswer = await inquirer.prompt([
                {
                  type: 'input',
                  name: 'name',
                  message: `Unit name (e.g. '${du.name}'):`,
                  default: du.name,
                },
                {
                  type: 'number',
                  name: 'seconds',
                  message: `Seconds per ${du.name}:`,
                  default: du.seconds,
                },
              ]);
              units.push({ name: unitAnswer.name, seconds: unitAnswer.seconds });
            }
          }
        }

        const styleAnswer = await inquirer.prompt([
          {
            type: 'list',
            name: 'default_pov',
            message: 'Default POV:',
            choices: ['first', 'third-limited', 'third-omniscient', 'narrator'],
            default: 'third-limited',
          },
          {
            type: 'input',
            name: 'tone',
            message: 'Tone (e.g. epic fantasy, noir, literary):',
            default: 'epic fantasy',
          },
          {
            type: 'input',
            name: 'language',
            message: 'Language (e.g. en-US, zh-CN):',
            default: 'en-US',
          },
        ]);

        for (const dir of DIRECTORIES) {
          const dirPath = path.join(process.cwd(), dir);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }
        }

        const universe: Universe = {
          name: nameAnswer.name,
          description: descAnswer.description,
          time_system: {
            type: timeTypeAnswer.type as 'real' | 'fictional',
            epoch_zero_label: epochZeroLabel,
            ...(epochZeroDate ? { epoch_zero_date: epochZeroDate } : {}),
            ...(units.length > 0 ? { units } : {}),
          },
          style: {
            default_pov: styleAnswer.default_pov,
            tone: styleAnswer.tone,
            language: styleAnswer.language,
          },
          created_at: new Date().toISOString(),
        };

        const yamlStr = YAML.stringify(universe);
        fs.writeFileSync(path.join(process.cwd(), 'universe.yaml'), yamlStr, 'utf-8');

        const dbPath = path.join(process.cwd(), '.epicpoet', 'index.sqlite');
        initDatabase(dbPath);

        console.log(chalk.green('\n✓ Project initialized successfully!'));
        console.log(chalk.cyan(`  Universe: ${universe.name}`));
        console.log(chalk.cyan(`  Time system: ${universe.time_system.type}`));
        console.log(chalk.cyan(`  Directories created: ${DIRECTORIES.join(', ')}`));
        console.log(chalk.cyan(`  Database: .epicpoet/index.sqlite`));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}
