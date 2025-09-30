const pg = require('pg')

// Database configuration object that reads from environment variables or uses default values
const dbConfig = {
  host: process.env.DB_HOST || 'pg',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  database: process.env.DB_NAME || 'video_converter'
}

// Function to update job status in the database
const dbUpdateJob = async (jobId, status, output, err) => {
  const query = `
    UPDATE jobs
    SET 
      status = $1,
      output = $2,
      error_message = $3
    WHERE mc_job_id = $4
  `
  const values = [status, output, err, jobId]

  const client = new pg.Client(dbConfig)
  await client.connect()
  await client.query(query, values)
  await client.end()
}

// Main event handler
exports.handler = async (event, context) => {
  try {
    console.log('EMS event:', event)

    const { jobId, status } = event.detail

    if (status === 'COMPLETE') {
      // FIXME here are the dragons
      const output = []
      event.detail.outputGroupDetails.forEach(grp => {
        grp.outputDetails.forEach(el => {
          output.push(el.outputFilePaths.toString())
        })
      })
      console.log(output)
      await dbUpdateJob(jobId, 'SUCCEEDED', output, '')
    } else if (status === 'ERROR') {
      const { errorCode, errorMessage } = event.detail
      await dbUpdateJob(jobId, 'FAILED', '', `${errorCode}: ${errorMessage}`)
    } else {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: `Unexpected event status: ${event}`
        })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `EMS event: ${event}`
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
