const mc = require('@aws-sdk/client-mediaconvert');
const pg = require('pg');
const axios = require('axios');

const dbConfig = { // FIXME config from env
  host: 'pg',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  ssl: false,
  database: 'video_converter',
};

const awsConfig = { //FIXME: config from env
  endpoint: 'http://mediaconvert:3000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
  forcePathStyle: true,
  sslEnabled: false,
};

const dbUpdateJob = async (key, jobId) => {
  const uuid = key.split('/')[1];
  const query = `
    UPDATE jobs
    SET 
      status = 'QUEUED',
      input_path = $1,
      mc_job_id = $2
    WHERE job_id = $3
  `
  const values = [key, jobId, uuid];
  const client = new pg.Client(dbConfig);

  await client.connect();
  await client.query(query, values);
};

const mcCreateJob = async (key) => {
  const params = {
    Role: "arn:aws:iam::123456789012:role/MediaConvertRole", // FIXME
    Settings: {
      Inputs: [
        {
          FileInput: `s3://test-bucket/${key}`,
          AudioSelectors: {
            "Audio Selector 1": {
              Offset: 0,
              DefaultSelection: "DEFAULT",
              ProgramSelection: 1
            }
          },
          VideoSelector: {
            ColorSpace: "FOLLOW"
          }
        }
      ],
      OutputGroups: [
        {
          Name: "File Group",
          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: {
              Destination: "s3://test-bucket/" // FIXME
            }
          },
          Outputs: [
            {
              VideoDescription: {
                Width: 1280,
                Height: 720,
                CodecSettings: {
                  Codec: "H_264",
                  H264Settings: {
                    MaxBitrate: 5000000,
                    RateControlMode: "QVBR",
                    SceneChangeDetect: "TRANSITION_DETECTION"
                  }
                }
              },
              AudioDescriptions: [
                {
                  AudioTypeControl: "FOLLOW_INPUT",
                  CodecSettings: {
                    Codec: "AAC",
                    AacSettings: {
                      AudioDescriptionBroadcasterMix: "NORMAL",
                      Bitrate: 96000,
                      RateControlMode: "CBR",
                      CodecProfile: "LC",
                      CodingMode: "CODING_MODE_2_0",
                      RawFormat: "NONE",
                      SampleRate: 48000,
                      Specification: "MPEG4"
                    }
                  },
                  AudioSourceName: "Audio Selector 1"
                }
              ],
              ContainerSettings: {
                Container: "MP4",
                Mp4Settings: {
                  CslgAtom: "INCLUDE",
                  FreeSpaceBox: "EXCLUDE",
                  MoovPlacement: "PROGRESSIVE_DOWNLOAD"
                }
              }
            }
          ]
        }
      ]
    }
  };

  //FIXME: real request not working with mocks env
  // const client = new mc.MediaConvertClient(config);
  // return await client.send(new mc.CreateJobCommand(params));
  const response = await axios.post(`${awsConfig.endpoint}/2017-08-29/jobs`, {});
  return response.data;
}

exports.handler = async (event, context) => {
  try {
    if (event.source === 'aws.s3' && event['detail-type'] === 'Object Created') {
      const key = event.detail.object.key;
      if (key.startsWith('input/')) {
        const ret = await mcCreateJob(key);
        await dbUpdateJob(key, ret.Job.Id);

        console.log('Job queued:', ret.Job.Id, key);
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: `Job queued: ${key} ${mcRet}`,
          }),
        };
      }
    }

    console.error('Unexpected event type:', event['detail-type']);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Unexpected event type',
      }),
    };
  } catch (err) {
    console.error('Error processing EventBridge event:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing EventBridge event',
        error: err.message,
      }),
    };
  }
};