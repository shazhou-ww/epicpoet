import { Command } from 'commander';

export function registerAddCommand(program: Command): void {
  const add = program
    .command('add')
    .description('Add a new entity to the project');

  add
    .command('character')
    .description('Add a new character')
    .action(() => {
      console.log('Add character - to be implemented');
    });

  add
    .command('event')
    .description('Add a new event')
    .action(() => {
      console.log('Add event - to be implemented');
    });

  add
    .command('location')
    .description('Add a new location')
    .action(() => {
      console.log('Add location - to be implemented');
    });

  add
    .command('concept')
    .description('Add a new concept')
    .action(() => {
      console.log('Add concept - to be implemented');
    });

  add
    .command('item')
    .description('Add a new item')
    .action(() => {
      console.log('Add item - to be implemented');
    });
}
