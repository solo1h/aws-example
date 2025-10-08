import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Logger } from 'winston'
import { Config, AwsConfig } from './config'

export class S3 {
  private log: Logger
  private cfg: AwsConfig

  constructor(config: Config, logger: Logger) {
    this.log = logger.child({ actor: 'AWS S3 client' })
    this.cfg = config.aws
  }

  generateKey(uuid: string, fileName: string): string {
    const timestamp = Date.now()
    const sanitizedFilename = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    return `input/${uuid}/${timestamp}-${sanitizedFilename}`
  }

  async getPresignedUrl(uuid: string, fname: string): Promise<string> {
    const key = this.generateKey(uuid, fname)
    const client = new S3Client(this.cfg.client)
    const command = new PutObjectCommand({
      Bucket: this.cfg.s3.bucketName,
      Key: key
    })
    const ret = await getSignedUrl(client, command, {
      expiresIn: this.cfg.s3.presignedUrlExpiry
    })
    this.log.debug('Presigned Url created', ret)
    return ret
  }
}
