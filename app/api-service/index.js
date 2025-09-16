import { config } from './src/utils/config.js';
import { logger, die } from './src/utils/logger.js';
import { runMigrations } from './src/utils/db.js';
import { runService } from './src/serveice.js';

const RunMode = {
  init: runMigrations,
  serve: runService,
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
  const log = logger.child({ service: config.serviceName });
  log.info(`Start service`);

  try {
    await RunMode[parseCliCommand()](config, log);
  } catch (err) {
    die(err);
  }
}

await run();
