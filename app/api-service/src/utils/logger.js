import { config } from './config.js';
import { format as _format, createLogger, transports as _transports } from 'winston';

const logFormat = _format.combine(
  _format.timestamp(),
  _format.errors({ stack: true }),
  _format.json()
);

export const logger = createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { service: config.serviceName },
  transports: [new _transports.Console()],
});

export function die(msg) {
  logger.error(msg);
  process.exit(1);
}
