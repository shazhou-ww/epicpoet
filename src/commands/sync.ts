import { Command } from 'commander';

export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync files to SQLite index')
    .option('--force', 'Force full rebuild')
    .action((options) => {
      console.log('Sync command - to be implemented');
    });
}
