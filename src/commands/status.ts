import { Command } from 'commander';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show project overview')
    .action(() => {
      console.log('Status command - to be implemented');
    });
}
