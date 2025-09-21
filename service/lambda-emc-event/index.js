const pg = require('pg')

const dbConfig = {
  host: 'pg',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  ssl: false,
  database: 'video_converter'
}

const dbUpdateJob = async (jobId, status, output, err) => {
  const query = `
    UPDATE jobs
    SET 
      status = '${status}',
      output = '${output}',
      error_message = '${err}'
    WHERE mc_job_id = '${jobId}'
  `
  const client = new pg.Client(dbConfig)
  await client.connect()
  await client.query(query)
}

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
    } else if (status === 'ERROR' ) {
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
