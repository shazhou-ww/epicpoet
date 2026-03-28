#!/usr/bin/env node

import { Command } from 'commander';
import { registerInitCommand } from './commands/init';
import { registerAddCommand } from './commands/add';
import { registerQueryCommand } from './commands/query';
import { registerWriteCommand } from './commands/write';
import { registerChapterCommand } from './commands/chapter';
import { registerSyncCommand } from './commands/sync';
import { registerStatusCommand } from './commands/status';

const program = new Command();

program
  .name('epicpoet')
  .version('0.1.0')
  .description('A CLI tool for AI-assisted novel writing with structured worldbuilding and information visibility tracking');

registerInitCommand(program);
registerAddCommand(program);
registerQueryCommand(program);
registerWriteCommand(program);
registerChapterCommand(program);
registerSyncCommand(program);
registerStatusCommand(program);

program.parse();
