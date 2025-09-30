const environment = process.env.ENVIRONMENT || 'test'

const serviceConfig = {
  name: process.env.SERVICE_NAME || 'api-service',
  port: process.env.SERVICE_PORT || '3000'
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  database: process.env.DB_NAME || 'video_converter'
}

const awsTest = {
  client: {
    endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4567',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
    },
    forcePathStyle: true,
    sslEnabled: false
  },
  s3: {
    bucketName: process.env.S3_BUCKET_NAME || 'test-bucket',
    presignedUrlExpiry: parseInt(process.env.S3_PRESIGNED_URL_EXPIRY || '3600')
  }
}

const awsProd = {
  client: {
    region: process.env.AWS_REGION || 'eu-central-1'
  },
  s3: {
    bucketName: process.env.S3_BUCKET_NAME || 'test-bucket',
    presignedUrlExpiry: parseInt(process.env.S3_PRESIGNED_URL_EXPIRY || '3600')
  }
}

const configTest = {
  env: environment,
  service: serviceConfig,
  db: dbConfig,
  aws: awsTest
}

const configProd = {
  env: environment,
  service: serviceConfig,
  db: dbConfig,
  aws: awsProd
}

export const config = environment === 'test' ? configTest : configProd
