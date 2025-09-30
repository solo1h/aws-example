import * as path from 'node:path'
import { Pool, Client } from 'pg'
import { migrate } from 'postgres-migrations'

/**
 * Runs database migrations for a PostgreSQL database.
 * This function:
 * 1. Connects to the database (without specifying the target DB name)
 * 2. Checks if the target database exists
 * 3. Creates the database if it doesn't exist
 * 4. Runs migrations against the target database
 *
 * @param {Object} config - Configuration object containing db settings
 * @param {Object} logger - Logger instance for logging operations
 */
export async function runMigrations (config, logger) {
  const log = logger.child({ actor: 'pg DB migration' })
  const dbConfig = config.db
  const dbName = dbConfig.database

  // Temporarily remove database name to connect to the default PostgreSQL instance
  dbConfig.database = undefined

  // Create a client connection for setup operations
  const client = new Client(dbConfig)
  await client.connect()

  try {
    // Check if the target database exists
    const res = await client.query(
      `SELECT datname FROM pg_catalog.pg_database WHERE datname = '${dbName}'`
    )

    if (res.rowCount === 0) {
      log.debug(`${dbName} database not found, creating it.`)
      // Create the database if it doesn't exist
      await client.query(`CREATE DATABASE "${dbName}";`)
      log.debug(`created database ${dbName}`)
    } else {
      log.debug(`${dbName} database exists.`)
    }
  } finally {
    // Close the temporary connection
    await client.end()
  }

  // Restore the database name and run migrations
  dbConfig.database = dbName
  await migrate(dbConfig, path.resolve(process.cwd(), 'migrations'), {
    logger: msg => {
      log.debug(msg)
    }
  })
}

/**
 * Creates a PostgreSQL connection pool with default settings.
 *
 * @param {Object} cfg - Database configuration object
 * @param {Object} log - Logger instance for logging operations
 * @returns {Pool} - Configured Pool instance
 */
export function createPool (cfg, log) {
  const pool = new Pool({
    ...cfg,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  })

  pool.on('connect', () => {
    log.info('Connected to PostgreSQL database')
  })

  pool.on('error', err => {
    log.error('PostgreSQL connection error:', err)
  })

  return pool
}

/**
 * Class for managing job operations.
 */
export class Jobs {
  /**
   * Creates a new Jobs instance.
   *
   * @param {Object} cfg - Database configuration object
   * @param {Object} log - Logger instance for logging operations
   */
  constructor (cfg, log) {
    this.log = log.child({ actor: 'pg' })
    this.cfg = cfg.db
    this.pool = null
  }

  /**
   * Connects to the PostgreSQL database and creates a connection pool.
   */
  async connect () {
    this.pool = createPool(this.cfg, this.log)
  }

  /**
   * Closes the connection pool.
   */
  async close () {
    await this.pool.end()
  }

  /**
   * Registers a new job in the database.
   *
   * @param {string} job_id - Unique job identifier
   * @param {string} input_key - Input data key for the job
   * @returns {Object} - The created job record
   */
  async register (job_id, input_key) {
    const query = 'INSERT INTO jobs (job_id, input) VALUES ($1, $2)'
    const values = [job_id, input_key]

    try {
      const result = await this.pool.query(query, values)
      return result.rows[0]
    } catch (error) {
      throw new Error(`Failed to register job: ${error.message}`)
    }
  }

  /**
   * Retrieves a job by its ID.
   *
   * @param {string} jobId - The job identifier
   * @returns {Object|null} - The job record or null if not found
   */
  async getById (jobId) {
    const query = 'SELECT * FROM jobs WHERE job_id = $1'

    try {
      const result = await this.pool.query(query, [jobId])
      return result.rows[0] || null
    } catch (error) {
      throw new Error(`Failed to get job: ${error.message}`)
    }
  }

  /**
   * Retrieves a list of jobs with pagination and optional status filtering.
   *
   * @param {Object} [options={}] - Options for filtering and pagination
   * @param {number} [options.limit=50] - Maximum number of records to return
   * @param {number} [options.offset=0] - Number of records to skip
   * @param {string} [options.status] - Optional status filter
   * @returns {Object} - Object containing jobs array and pagination information
   */
  async getStatuses (options = {}) {
    const { limit = 50, offset = 0, status } = options

    let query = `
      SELECT 
        job_id,
        status,
        updated_at
      FROM jobs
    `

    const values = []
    let paramCount = 0

    // Add status filter if provided
    if (status) {
      paramCount++
      query += ` WHERE status = $${paramCount}`
      values.push(status)
    }

    // Add ordering and pagination
    query += ' ORDER BY updated_at DESC, job_id DESC'
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`
    values.push(limit, offset)

    // Count query for total records
    let countQuery = 'SELECT COUNT(*) as total FROM jobs'
    const countValues = []

    if (status) {
      countQuery += ' WHERE status = $1'
      countValues.push(status)
    }

    try {
      const [jobsResult, countResult] = await Promise.all([
        this.pool.query(query, values),
        this.pool.query(countQuery, countValues)
      ])

      const jobs = jobsResult.rows
      const total = parseInt(countResult.rows[0].total)
      const hasMore = offset + limit < total
      const totalPages = Math.ceil(total / limit)
      const currentPage = Math.floor(offset / limit) + 1

      return {
        jobs,
        pagination: {
          total,
          limit,
          offset,
          hasMore,
          totalPages,
          currentPage
        }
      }
    } catch (error) {
      throw new Error(`Failed to get jobs list: ${error.message}`)
    }
  }

  /**
   * Updates a job record with the provided updates.
   *
   * @param {string} jobId - The job identifier to update
   * @param {Object} updates - Object containing fields to update
   * @returns {Object|null} - The updated job record or null if not found
   */
  async updateJob (jobId, updates) {
    const allowedFields = ['status', 'output', 'output_cdn_url', 'mc_job_id', 'error_message']
    const updateFields = []
    const values = []
    let paramCount = 0

    // Build dynamic update query
    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) {
        paramCount++
        updateFields.push(`${field} = $${paramCount}`)
        values.push(value)
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update')
    }

    const query = `
      UPDATE jobs 
      SET ${updateFields.join(', ')}
      WHERE job_id = $${++paramCount}
      RETURNING *
    `

    values.push(jobId)

    try {
      const result = await this.pool.query(query, values)
      return result.rows[0] || null
    } catch (error) {
      throw new Error(`Failed to update job: ${error.message}`)
    }
  }
}
