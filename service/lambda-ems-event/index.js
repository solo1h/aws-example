const pg = require('pg');

const dbUpdateJob = async (key) => {
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
    console.log('EMS event:', event);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `EMS event: ${event}`,
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
