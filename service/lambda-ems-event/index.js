const pg = require('pg');

const dbUpdateJob = async (jobId, status, output, err) => {
  const dbConfig = {
    host: 'pg',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    ssl: false,
    database: 'video_converter',
  };

  const query = `
    UPDATE jobs
    SET 
      status = '${status}',
      output = '${output}',
      error_message = '${err}'
    WHERE mc_job_id = '${jobId}'
  `;
  const client = new pg.Client(dbConfig);
  await client.connect();
  await client.query(query);
};

exports.handler = async (event, context) => {
  try {
    console.log('EMS event:', event);

    const { jobId, status } = event.detail;

    switch (status) {
      case 'COMPLETE':
        await dbUpdateJob(jobId, 'SUCCEEDED', '', ''); //FIXME output
        break;
      case 'ERROR':
        await dbUpdateJob(jobId, 'FAILED', '', ''); //FIXME
        break;
        defualt: return {
          statusCode: 401,
          body: JSON.stringify({
            message: `Unexpected event status: ${event}`,
          }),
        };
    }

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
