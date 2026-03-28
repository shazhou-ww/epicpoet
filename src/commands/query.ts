import { Command } from 'commander';

export function registerQueryCommand(program: Command): void {
  const query = program
    .command('query')
    .description('Query worldbuilding data');

  query
    .command('knowledge <character>')
    .description('Query what a character knows at a given time')
    .requiredOption('--at <epoch>', 'Epoch time to query at')
    .action((character, options) => {
      console.log(`Query knowledge for "${character}" at epoch ${options.at} - to be implemented`);
    });

  query
    .command('timeline')
    .description('View event timeline')
    .option('--character <name>', 'Filter by character')
    .option('--from <epoch>', 'Start epoch')
    .option('--to <epoch>', 'End epoch')
    .action((options) => {
      console.log('Query timeline - to be implemented');
    });
}
