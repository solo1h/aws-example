import { config } from './src/config.js'
import { logger, die } from './src/logger.js'
import { runMigrations } from './src/db.js'
import { runService } from './src/service.js'

// Defines the available run modes for the application.
const RunMode = {
  init: runMigrations,
  serve: runService
}

// Parses the CLI command argument and validates it.
// Validate that the command is either 'init' or 'serve'
function parseCliCommand () {
  const args = process.argv.slice(2)
  if (args.length !== 1) {
    die(`Expected 1 CLI argument, but ${args.length} is given.`)
  }

  const command = args[0]
  if (!Object.keys(RunMode).includes(command)) {
    die(`Expected command 'init' or 'serve', but '${command}' is given.`)
  }

  return command
}

// Main execution function for the application.
async function run () {
  const log = logger.child({ service: config.service.name })
  log.info('Start service')

  try {
    await RunMode[parseCliCommand()](config, log)
  } catch (err) {
    die(err)
  }
}

// Start the application by calling the run function
await run()
