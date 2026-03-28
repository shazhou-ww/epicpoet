import { Command } from 'commander';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new novel project')
    .option('--name <name>', 'Universe name')
    .option('--time-system <type>', 'Time system type (real or fictional)')
    .action((options) => {
      console.log('Init command - to be implemented');
    });
}
