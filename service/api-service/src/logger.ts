import { Logger, createLogger, format, transports } from 'winston'

const logFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
)

export const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: logFormat,
  transports: [new transports.Console()]
})

export function die(msg: string): never {
  logger.error(msg)
  process.exit(1)
}
