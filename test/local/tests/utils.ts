import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge'

const awsConfig = {
  endpoint: 'http://localhost:4567',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
  forcePathStyle: true,
  sslEnabled: false,
}

const ebClient = new EventBridgeClient(awsConfig)

export async function sendEventError(jobId: string, code: number, msg: string) {
  const res = await ebClient.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: 'aws.mediaconvert',
          DetailType: 'MediaConvert Job State Change',
          Resources: [
            `arn:aws:mediaconvert:us-east-1:000000000000:jobs/${jobId}`,
          ],
          Detail: JSON.stringify({
            timestamp: Date.now(),
            queue: 'arn:aws:mediaconvert:us-east-1:000000000000:queues/Default',
            jobId: jobId,
            status: 'ERROR',
            errorCode: code,
            errorMessage: msg,
          }),
        },
      ],
    })
  )
  console.log(res)
}

export async function sendEventComplete(jobId: string, outputFilePath: string) {
  const res = await ebClient.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: 'aws.mediaconvert',
          DetailType: 'MediaConvert Job State Change',
          Resources: [
            `arn:aws:mediaconvert:us-east-1:000000000000:jobs/${jobId}`,
          ],
          Detail: JSON.stringify({
            timestamp: Date.now(),
            queue: 'arn:aws:mediaconvert:us-east-1:000000000000:queues/Default',
            jobId: jobId,
            status: 'COMPLETE',
            userMetadata: {},
            warnings: [
              {
                code: '000000',
                count: 1,
              },
            ],
            outputGroupDetails: [
              {
                outputDetails: [
                  {
                    outputFilePaths: [outputFilePath],
                    durationInMs: 30041,
                    videoDetails: {
                      widthInPx: 1920,
                      heightInPx: 1080,
                      qvbrAvgQuality: 7.38,
                      qvbrMinQuality: 7,
                      qvbrMaxQuality: 8,
                      qvbrMinQualityLocation: 2168,
                      qvbrMaxQualityLocation: 25025,
                    },
                  },
                ],
                type: 'FILE_GROUP',
              },
            ],
            paddingInserted: 0,
            blackVideoDetected: 10,
            blackSegments: [
              {
                start: 0,
                end: 10,
              },
            ],
          }),
        },
      ],
    })
  )
  console.log(res)
}
