const pg = require('pg');

const dbUpdateJob = async (key)  => {
  const dbConfig = {
    host: 'pg',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    ssl: false,
    database: 'video_converter',
  };

  const uuid = key.split('/')[1];
  const query = `
    UPDATE jobs
    SET 
      status = 'QUEUED',
      input_path = '${key}'
    WHERE job_id = '${uuid}'
  `
  const client = new pg.Client(dbConfig);
  await client.connect();
  await client.query(query);
};

exports.handler = async (event, context) => {
  try {
    if (event.source === 'aws.s3' && event['detail-type'] === 'Object Created') {
      const key = event.detail.object.key;
      if (key.startsWith('input/')) {
        await dbUpdateJob(key)

        console.log('Job queued:', key);
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: `Job queued: ${key}`,
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
