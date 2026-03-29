import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { findProjectRoot } from '../db/sync';

interface StageActor {
  name: string;
  position: string;
}

interface StageMessage {
  id: number;
  type: 'say' | 'whisper' | 'act' | 'think' | 'move';
  actor: string;
  to?: string;
  volume?: 'normal' | 'loud' | 'quiet';
  text: string;
  receivers: string[];
  timestamp: string;
}

interface StageState {
  scene: string;
  time: number;
  location: string;
  actors: StageActor[];
  messages: StageMessage[];
  opened_at: string;
  status: 'open' | 'closed';
}

function getStagePath(projectRoot: string): string {
  return path.join(projectRoot, '.epicpoet', 'stage.json');
}

function loadStage(projectRoot: string, requireOpen = true): StageState {
  const stagePath = getStagePath(projectRoot);
  if (!fs.existsSync(stagePath)) {
    throw new Error('No active stage found. Use "epicpoet stage open" to start a scene.');
  }
  const stage = JSON.parse(fs.readFileSync(stagePath, 'utf-8')) as StageState;
  if (requireOpen && stage.status !== 'open') {
    throw new Error('Stage is closed. Use "epicpoet stage open" to start a new scene.');
  }
  return stage;
}

function saveStage(projectRoot: string, stage: StageState): void {
  fs.writeFileSync(getStagePath(projectRoot), JSON.stringify(stage, null, 2), 'utf-8');
}

function computeReceivers(
  actors: StageActor[],
  type: string,
  actorName: string,
  to: string | undefined,
  volume: string,
): string[] {
  if (type === 'think') return [];

  if (type === 'whisper') {
    if (to && actors.some(a => a.name === to)) return [to];
    return [];
  }

  const others = actors.filter(a => a.name !== actorName);

  if (type === 'say') {
    if (volume === 'loud') {
      return others.map(a => a.name);
    }
    if (volume === 'normal') {
      return others
        .filter(a => a.position !== '远处' && a.position !== '隔墙')
        .map(a => a.name);
    }
    // quiet
    const result = others
      .filter(a => a.position === '面对面' || a.position === '暗处旁观')
      .map(a => a.name);
    if (to && !result.includes(to) && actors.some(a => a.name === to)) {
      result.push(to);
    }
    return result;
  }

  // 'act' and 'move': visible to nearby actors, excluding '远处' and '隔墙'
  const visible = others
    .filter(a => a.position !== '远处' && a.position !== '隔墙');
  // '暗处旁观' actors can perceive act/move
  const hiddenObservers = others
    .filter(a => a.position === '暗处旁观' && !visible.some(v => v.name === a.name));
  return [...visible, ...hiddenObservers].map(a => a.name);
}

const MSG_ICONS: Record<string, string> = {
  say: '💬',
  whisper: '🤫',
  act: '🎭',
  think: '💭',
  move: '🚶',
};

export function registerStageCommand(program: Command): void {
  const stage = program
    .command('stage')
    .description('Virtual theater for character interaction');

  // --- stage open ---
  stage
    .command('open')
    .description('Open a new stage scene')
    .requiredOption('--scene <name>', 'Scene name')
    .requiredOption('--time <number>', 'Scene time', parseInt)
    .requiredOption('--location <name>', 'Scene location')
    .requiredOption('--actors <spec>', 'Actors spec: name1:position1,name2:position2')
    .action((options: { scene: string; time: number; location: string; actors: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const stagePath = getStagePath(projectRoot);

        if (fs.existsSync(stagePath)) {
          const existing = JSON.parse(fs.readFileSync(stagePath, 'utf-8')) as StageState;
          if (existing.status === 'open') {
            console.error(chalk.red('Error: A stage is already open. Close it first with "epicpoet stage close".'));
            process.exit(1);
          }
        }

        const actors: StageActor[] = options.actors.split(',').map(item => {
          const parts = item.trim().split(':');
          return { name: parts[0].trim(), position: (parts[1] || '同区域').trim() };
        });

        const charsDir = path.join(projectRoot, 'characters');
        for (const actor of actors) {
          const charFile = path.join(charsDir, `${actor.name}.yaml`);
          const charFileMd = path.join(charsDir, `${actor.name}.md`);
          if (!fs.existsSync(charFile) && !fs.existsSync(charFileMd)) {
            console.log(chalk.yellow(`Warning: character file for "${actor.name}" not found in characters/`));
          }
        }

        const epicpoetDir = path.join(projectRoot, '.epicpoet');
        if (!fs.existsSync(epicpoetDir)) {
          fs.mkdirSync(epicpoetDir, { recursive: true });
        }

        const stageState: StageState = {
          scene: options.scene,
          time: options.time,
          location: options.location,
          actors,
          messages: [],
          opened_at: new Date().toISOString(),
          status: 'open',
        };

        saveStage(projectRoot, stageState);

        console.log(chalk.green('\n✓ Stage opened'));
        console.log(chalk.cyan(`  Scene:    ${stageState.scene}`));
        console.log(chalk.cyan(`  Location: ${stageState.location}`));
        console.log(chalk.cyan(`  Time:     ${stageState.time}`));
        console.log(chalk.cyan('  Actors:'));
        for (const a of actors) {
          console.log(chalk.yellow(`    - ${a.name}`) + chalk.dim(` (${a.position})`));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  // --- stage say ---
  stage
    .command('say <text>')
    .description('A character says something')
    .requiredOption('--actor <name>', 'Who is speaking')
    .option('--to <name>', 'Directed at someone')
    .option('--volume <level>', 'Volume: normal, loud, quiet', 'normal')
    .action((text: string, options: { actor: string; to?: string; volume: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const stage = loadStage(projectRoot);

        if (!stage.actors.some(a => a.name === options.actor)) {
          throw new Error(`Actor "${options.actor}" is not on stage.`);
        }

        const receivers = computeReceivers(stage.actors, 'say', options.actor, options.to, options.volume);
        const msg: StageMessage = {
          id: stage.messages.length + 1,
          type: 'say',
          actor: options.actor,
          to: options.to,
          volume: options.volume as StageMessage['volume'],
          text,
          receivers,
          timestamp: new Date().toISOString(),
        };
        stage.messages.push(msg);
        saveStage(projectRoot, stage);

        const toStr = options.to ? ` → ${chalk.yellow(options.to)}` : '';
        console.log(`${MSG_ICONS.say} ${chalk.yellow(options.actor)}${toStr}: ${chalk.white(text)}`);
        console.log(chalk.dim(`  [${options.volume}] heard by: ${receivers.length > 0 ? receivers.join(', ') : 'no one'}`));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  // --- stage whisper ---
  stage
    .command('whisper <text>')
    .description('A character whispers to another')
    .requiredOption('--actor <name>', 'Who is whispering')
    .requiredOption('--to <name>', 'Who they whisper to')
    .action((text: string, options: { actor: string; to: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const stage = loadStage(projectRoot);

        if (!stage.actors.some(a => a.name === options.actor)) {
          throw new Error(`Actor "${options.actor}" is not on stage.`);
        }
        if (!stage.actors.some(a => a.name === options.to)) {
          throw new Error(`Actor "${options.to}" is not on stage.`);
        }

        const receivers = [options.to];
        const msg: StageMessage = {
          id: stage.messages.length + 1,
          type: 'whisper',
          actor: options.actor,
          to: options.to,
          text,
          receivers,
          timestamp: new Date().toISOString(),
        };
        stage.messages.push(msg);
        saveStage(projectRoot, stage);

        console.log(`${MSG_ICONS.whisper} ${chalk.yellow(options.actor)} → ${chalk.yellow(options.to)}: ${chalk.gray(text)}`);
        console.log(chalk.dim('  [whisper] only heard by: ' + options.to));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  // --- stage act ---
  stage
    .command('act <text>')
    .description('A character performs an action')
    .requiredOption('--actor <name>', 'Who is acting')
    .action((text: string, options: { actor: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const stage = loadStage(projectRoot);

        if (!stage.actors.some(a => a.name === options.actor)) {
          throw new Error(`Actor "${options.actor}" is not on stage.`);
        }

        const receivers = computeReceivers(stage.actors, 'act', options.actor, undefined, 'normal');
        const msg: StageMessage = {
          id: stage.messages.length + 1,
          type: 'act',
          actor: options.actor,
          text,
          receivers,
          timestamp: new Date().toISOString(),
        };
        stage.messages.push(msg);
        saveStage(projectRoot, stage);

        console.log(`${MSG_ICONS.act} ${chalk.yellow(options.actor)}: ${chalk.italic(text)}`);
        console.log(chalk.dim(`  seen by: ${receivers.length > 0 ? receivers.join(', ') : 'no one'}`));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  // --- stage think ---
  stage
    .command('think <text>')
    .description('A character thinks privately')
    .requiredOption('--actor <name>', 'Who is thinking')
    .action((text: string, options: { actor: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const stage = loadStage(projectRoot);

        if (!stage.actors.some(a => a.name === options.actor)) {
          throw new Error(`Actor "${options.actor}" is not on stage.`);
        }

        const msg: StageMessage = {
          id: stage.messages.length + 1,
          type: 'think',
          actor: options.actor,
          text,
          receivers: [],
          timestamp: new Date().toISOString(),
        };
        stage.messages.push(msg);
        saveStage(projectRoot, stage);

        console.log(`${MSG_ICONS.think} ${chalk.yellow(options.actor)}: ${chalk.dim(text)}`);
        console.log(chalk.dim('  [private thought - no one else knows]'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  // --- stage move ---
  stage
    .command('move')
    .description('A character changes position')
    .requiredOption('--actor <name>', 'Who is moving')
    .requiredOption('--position <pos>', 'New position')
    .action((options: { actor: string; position: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const stage = loadStage(projectRoot);

        const actorEntry = stage.actors.find(a => a.name === options.actor);
        if (!actorEntry) {
          throw new Error(`Actor "${options.actor}" is not on stage.`);
        }

        const oldPosition = actorEntry.position;
        actorEntry.position = options.position;

        const text = `${options.actor} moved from ${oldPosition} to ${options.position}`;
        const receivers = computeReceivers(stage.actors, 'move', options.actor, undefined, 'normal');
        const msg: StageMessage = {
          id: stage.messages.length + 1,
          type: 'move',
          actor: options.actor,
          text,
          receivers,
          timestamp: new Date().toISOString(),
        };
        stage.messages.push(msg);
        saveStage(projectRoot, stage);

        console.log(`${MSG_ICONS.move} ${chalk.yellow(options.actor)}: ${oldPosition} → ${options.position}`);
        console.log(chalk.dim(`  noticed by: ${receivers.length > 0 ? receivers.join(', ') : 'no one'}`));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  // --- stage inbox ---
  stage
    .command('inbox')
    .description("Show what a specific character perceived")
    .requiredOption('--actor <name>', 'Whose inbox to view')
    .action((options: { actor: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const stage = loadStage(projectRoot, false);

        const received = stage.messages.filter(m => m.receivers.includes(options.actor));

        if (received.length === 0) {
          console.log(chalk.dim(`No messages received by ${options.actor}.`));
          return;
        }

        console.log(chalk.cyan(`\n📥 Inbox for ${chalk.yellow(options.actor)} (${received.length} messages)\n`));
        for (const m of received) {
          const icon = MSG_ICONS[m.type] || '?';
          const toStr = m.to ? ` → ${chalk.yellow(m.to)}` : '';
          switch (m.type) {
            case 'say':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}${toStr}: ${chalk.white(m.text)}`);
              break;
            case 'whisper':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}${toStr}: ${chalk.gray(m.text)}`);
              break;
            case 'act':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}: ${chalk.italic(m.text)}`);
              break;
            case 'move':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}: ${m.text}`);
              break;
          }
        }
        console.log();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  // --- stage log ---
  stage
    .command('log')
    .description('Show full omniscient log of all stage messages')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const stage = loadStage(projectRoot, false);

        if (stage.messages.length === 0) {
          console.log(chalk.dim('No messages on stage.'));
          return;
        }

        console.log(chalk.cyan(`\n📜 Stage Log — ${stage.scene} @ ${stage.location} (${stage.messages.length} messages)\n`));
        for (const m of stage.messages) {
          const icon = MSG_ICONS[m.type] || '?';
          const toStr = m.to ? ` → ${chalk.yellow(m.to)}` : '';
          switch (m.type) {
            case 'say':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}${toStr}: ${chalk.white(m.text)}`);
              break;
            case 'whisper':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}${toStr}: ${chalk.gray(m.text)}`);
              break;
            case 'act':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}: ${chalk.italic(m.text)}`);
              break;
            case 'think':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}: ${chalk.dim(m.text)}`);
              break;
            case 'move':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}: ${m.text}`);
              break;
          }
        }
        console.log();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });

  // --- stage close ---
  stage
    .command('close')
    .description('Close the current stage and summarize')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const stage = loadStage(projectRoot);

        stage.status = 'closed';

        console.log(chalk.cyan('\n═══════════════════════════════════════'));
        console.log(chalk.cyan.bold(`  Stage Closed: ${stage.scene}`));
        console.log(chalk.cyan('═══════════════════════════════════════'));
        console.log(chalk.cyan(`  Location: ${stage.location}`));
        console.log(chalk.cyan(`  Time:     ${stage.time}`));
        console.log(chalk.cyan(`  Messages: ${stage.messages.length}`));
        console.log(chalk.cyan(`  Actors:   ${stage.actors.map(a => a.name).join(', ')}`));

        console.log(chalk.cyan('\n── Per-Actor Knowledge Summary ──\n'));
        for (const actor of stage.actors) {
          const received = stage.messages.filter(m => m.receivers.includes(actor.name));
          const typeCounts: Record<string, number> = {};
          for (const m of received) {
            typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
          }

          console.log(chalk.yellow(`  ${actor.name}`) + chalk.dim(` (${actor.position}):`));
          if (received.length === 0) {
            console.log(chalk.dim('    Perceived nothing.'));
          } else {
            const parts = Object.entries(typeCounts).map(
              ([t, c]) => `${c} ${t}${c > 1 ? 's' : ''}`,
            );
            console.log(chalk.dim(`    Perceived ${received.length} events: ${parts.join(', ')}`));
          }

          const ownThoughts = stage.messages.filter(m => m.type === 'think' && m.actor === actor.name);
          if (ownThoughts.length > 0) {
            console.log(chalk.dim(`    Had ${ownThoughts.length} private thought${ownThoughts.length > 1 ? 's' : ''}`));
          }
        }

        console.log(chalk.cyan('\n── Full Log ──\n'));
        for (const m of stage.messages) {
          const icon = MSG_ICONS[m.type] || '?';
          const toStr = m.to ? ` → ${chalk.yellow(m.to)}` : '';
          switch (m.type) {
            case 'say':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}${toStr}: ${chalk.white(m.text)}`);
              break;
            case 'whisper':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}${toStr}: ${chalk.gray(m.text)}`);
              break;
            case 'act':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}: ${chalk.italic(m.text)}`);
              break;
            case 'think':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}: ${chalk.dim(m.text)}`);
              break;
            case 'move':
              console.log(`  ${icon} ${chalk.yellow(m.actor)}: ${m.text}`);
              break;
          }
        }

        saveStage(projectRoot, stage);

        console.log(chalk.green('\n✓ Stage closed and saved.\n'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exit(1);
      }
    });
}
