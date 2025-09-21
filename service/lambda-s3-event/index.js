const mc = require('@aws-sdk/client-mediaconvert')
const pg = require('pg')
const axios = require('axios')

const config = {
  env: 'development',
  db: {
    host: process.env.DB_HOST || 'pg',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    database: process.env.DB_NAME || 'video_converter'
 
  },
  aws: {
    client: { // FIXME: switch depends on env
      endpoint: 'http://mediaconvert:3000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      },
      forcePathStyle: true,
      sslEnabled: false
    },
    s3: {
      bucketName: process.env.S3_BUCKET_NAME || 'test-bucket',
    },
    emc: {
      role: 'arn:aws:iam::000000000000:role/MediaConvertRole' 
    }
  }
}

const dbUpdateJob = async (key, jobId) => {
  const uuid = key.split('/')[1]
  const query = `
    UPDATE jobs
    SET 
      status = 'QUEUED',
      input = $1,
      mc_job_id = $2
    WHERE job_id = $3
  `
  const values = [key, jobId, uuid]
  const client = new pg.Client(config.db)

  await client.connect()
  await client.query(query, values)
}

const mcCreateJob = async (s3Bucket, s3Key, emcRole) => {
  const params = {
    Role: emcRole,
    Settings: {
      Inputs: [
        {
          FileInput: `s3://${s3Bucket}/${s3Key}`,
          AudioSelectors: {
            'Audio Selector 1': {
              Offset: 0,
              DefaultSelection: 'DEFAULT',
              ProgramSelection: 1
            }
          },
          VideoSelector: {
            ColorSpace: 'FOLLOW'
          }
        }
      ],
      OutputGroups: [
        {
          Name: 'File Group',
          OutputGroupSettings: {
            Type: 'FILE_GROUP_SETTINGS',
            FileGroupSettings: {
              Destination: `s3://${s3Bucket}/`
            }
          },
          Outputs: [
            {
              VideoDescription: {
                Width: 1280,
                Height: 720,
                CodecSettings: {
                  Codec: 'H_264',
                  H264Settings: {
                    MaxBitrate: 5000000,
                    RateControlMode: 'QVBR',
                    SceneChangeDetect: 'TRANSITION_DETECTION'
                  }
                }
              },
              AudioDescriptions: [
                {
                  AudioTypeControl: 'FOLLOW_INPUT',
                  CodecSettings: {
                    Codec: 'AAC',
                    AacSettings: {
                      AudioDescriptionBroadcasterMix: 'NORMAL',
                      Bitrate: 96000,
                      RateControlMode: 'CBR',
                      CodecProfile: 'LC',
                      CodingMode: 'CODING_MODE_2_0',
                      RawFormat: 'NONE',
                      SampleRate: 48000,
                      Specification: 'MPEG4'
                    }
                  },
                  AudioSourceName: 'Audio Selector 1'
                }
              ],
              ContainerSettings: {
                Container: 'MP4',
                Mp4Settings: {
                  CslgAtom: 'INCLUDE',
                  FreeSpaceBox: 'EXCLUDE',
                  MoovPlacement: 'PROGRESSIVE_DOWNLOAD'
                }
              }
            }
          ]
        }
      ]
    }
  }

  // FIXME: real request not working with mocks env
  // const client = new mc.MediaConvertClient(config);
  // return await client.send(new mc.CreateJobCommand(params));
  const response = await axios.post(`${config.aws.client.endpoint}/2017-08-29/jobs`, {})
  return response.data
}

exports.handler = async (event, context) => {
  try {
    if (event.source === 'aws.s3' && event['detail-type'] === 'Object Created') {
      const key = event.detail.object.key
      if (key.startsWith('input/')) {
        const ret = await mcCreateJob(config.aws.s3.bucketName, key ,config.aws.emc.role)
        const jobId = ret.Job.Id
        await dbUpdateJob(key, jobId)

        console.log('Job queued:', jobId, key)
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: `Job queued: ${jobId}, ${key}`
          })
        }
      }
    }

    console.error('Unexpected event type:', event['detail-type'])
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Unexpected event type'
      })
    }
  } catch (err) {
    console.error('Error processing EventBridge event:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing EventBridge event',
        error: err.message
      })
    }
  }
}
