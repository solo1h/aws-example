import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export class S3 {
  constructor (config, logger) {
    this.log = logger.child({ actor: 'AWS S3 client' })
    this.cfg = config.aws
  }

  generateKey (uuid, fname) {
    const timestamp = Date.now()
    const sanitizedFilename = fname.replace(/[^a-zA-Z0-9.-]/g, '_')
    return `input/${uuid}/${timestamp}-${sanitizedFilename}`
  }

  async getPresignedUrl (uuid, fname) {
    const key = this.generateKey(uuid, fname)
    const client = new S3Client(this.cfg.client)
    const command = new PutObjectCommand({ Bucket: this.cfg.s3.bucketName, Key: key })
    const ret = await getSignedUrl(client, command, { expiresIn: this.cfg.s3.presignedUrlExpiry })
    this.log.debug('Presigned Url created', ret)
    return ret
  }
}
