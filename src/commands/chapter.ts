import { Command } from 'commander';

export function registerChapterCommand(program: Command): void {
  const chapter = program
    .command('chapter')
    .description('Manage chapters');

  chapter
    .command('create')
    .description('Create a new chapter')
    .action(() => {
      console.log('Chapter create - to be implemented');
    });

  chapter
    .command('list')
    .description('List all chapters')
    .action(() => {
      console.log('Chapter list - to be implemented');
    });

  chapter
    .command('show')
    .description('Show chapter details')
    .action(() => {
      console.log('Chapter show - to be implemented');
    });
}
