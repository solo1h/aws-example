import { config } from './src/utils/config.js';
import { logger, die } from './src/utils/logger.js';
import { runMigrations } from './src/utils/db.js';

async function runApp(cfg, log) {
  log.info('Serving API');
}

const RunMode = {
  init: runMigrations,
  serve: runApp,
};

function parseCliCommand() {
  const args = process.argv.slice(2);
  if (args.length != 1) {
    die(`Expected 1 CLI argument, but ${args.length} is given.`);
  }

  const command = args[0];
  if (!Object.keys(RunMode).includes(command)) {
    die(`Expected command 'init' or 'serve', but '${command}' is given.`);
  }

  return command;
}

async function run() {
  logger.info(`Start ${config.serviceName}`);

  try {
    await RunMode[parseCliCommand()](config, logger);
  } catch (err) {
    die(err);
  }
}

run();
