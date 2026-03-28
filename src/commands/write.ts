import { Command } from 'commander';

export function registerWriteCommand(program: Command): void {
  program
    .command('write')
    .description('Create a new scene')
    .option('--event <id>', 'Event id this scene depicts')
    .option('--pov <character>', 'POV character id or "narrator"')
    .option('--epoch <number>', 'Narrative time (epoch seconds)')
    .option('--location <id>', 'Location id')
    .action((options) => {
      console.log('Write command - to be implemented');
    });
}
