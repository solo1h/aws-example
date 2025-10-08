import { Logger } from 'winston'
import { config, type Config } from './config'
import { logger, die } from './logger'
import { runMigrations } from './db'
import { runService } from './service'

// Define types for better type safety
type RunModeKey = 'init' | 'serve'

interface RunMode {
  init: (config: Config, log: Logger) => Promise<void>
  serve: (config: Config, log: Logger) => Promise<void>
}

// Defines the available run modes for the application.
const RunMode: RunMode = {
  init: runMigrations,
  serve: runService
}

// Parses the CLI command argument and validates it.
// Validate that the command is either 'init' or 'serve'
function parseCliCommand(): RunModeKey {
  const args = process.argv.slice(2)
  if (args.length !== 1) {
    die(`Expected 1 CLI argument, but ${args.length} is given.`)
  }

  const command = args[0] as RunModeKey
  if (!Object.keys(RunMode).includes(command)) {
    die(`Expected command 'init' or 'serve', but '${command}' is given.`)
  }

  return command
}

// Main execution function for the application.
async function run(): Promise<void> {
  const log = logger.child({ service: config.service.name })
  log.info('Start service')

  try {
    await RunMode[parseCliCommand()](config, log)
  } catch (err) {
    die(err)
  }
}

// Start the application by calling the run function
run()
