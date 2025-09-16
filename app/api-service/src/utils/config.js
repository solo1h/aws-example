// FIXME: import * as z from 'zod';

export const config = {
  logLevel: process.env.LOG_LEVEL || 'debug',
  serviceName: process.env.SERVICE_NAME || 'api-service',
  servicePort: process.env.SERVICE_PORT || '3000',
  serviceApi: process.env.SERVICE_API || 'v1',
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: process.env.DB_PORT || '5432',
  dbName: process.env.DB_NAME || 'video_converter',
  dbUser: process.env.DB_USER || 'postgres',
  dbPass: process.env.DB_PASSWORD || 'postgres',
  dbSsl: process.env.DB_SSL || 'false',
};

/* FIXME: validate config
const configSchema = z.object({
  serviceName: z.string().min(3).max(128),
  serviceMode: z.enum(['init', 'serve']),
  logLevel: z.enum(['debug', 'info', 'error'])
});

export function validateConfig() {
  return configSchema.parse(config);
}
*/
