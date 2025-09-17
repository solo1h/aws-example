// FIXME: import * as z from 'zod';

export const config = {
  serviceName: process.env.SERVICE_NAME || 'api-service',
  servicePort: process.env.SERVICE_PORT || '3000',
  serviceApi: process.env.SERVICE_API || 'v1',
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: process.env.DB_PORT || '5432',
  dbName: process.env.DB_NAME || 'video_converter',
  dbUser: process.env.DB_USER || 'postgres',
  dbPass: process.env.DB_PASSWORD || 'postgres',
  dbSsl: process.env.DB_SSL || 'false',
  awsEndpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4567',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  awsKey: process.env.AWS_ACCESS_KEY_ID || 'test',
  awsSecret: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  awsS3BucketName: process.env.S3_BUCKET_NAME || 'test-bucket',
  awsS3PresignedUrlExpiry: process.env.S3_PRESIGNED_URL_EXPIRY || '3600',
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
