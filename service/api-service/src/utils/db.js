import * as path from 'node:path';
import { Pool, Client } from 'pg';
import { migrate } from 'postgres-migrations';

export function getDbConfig(cfg) {
  return {
    host: cfg.dbHost,
    port: parseInt(cfg.dbPort),
    user: cfg.dbUser,
    password: cfg.dbPass,
    ssl: cfg.dbSsl === 'true' ? { rejectUnauthorized: false } : false,
    database: cfg.dbName,
  };
}

export async function runMigrations(config, logger) {
  const log = logger.child({ actor: 'pg DB migration' });
  const dbConfig = getDbConfig(config);
  dbConfig.database = undefined;

  const client = new Client(dbConfig);
  await client.connect();
  try {
    const res = await client.query(
      `SELECT datname FROM pg_catalog.pg_database WHERE datname = '${config.dbName}'`
    );

    if (res.rowCount === 0) {
      log.debug(`${config.dbName} database not found, creating it.`);
      await client.query(`CREATE DATABASE "${config.dbName}";`);
      log.debug(`created database ${config.dbName}`);
    } else {
      log.debug(`${config.dbName} database exists.`);
    }
  } finally {
    await client.end();
  }

  await migrate(getDbConfig(config), path.resolve(process.cwd(), 'migrations'), {
    logger: msg => {
      log.debug(msg);
    },
  });
}

export function createPool(cfg, log) {
  const pool = new Pool({
    ...cfg,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('connect', () => {
    log.info('Connected to PostgreSQL database');
  });

  pool.on('error', err => {
    log.error('PostgreSQL connection error:', err);
  });

  return pool;
}

export class Jobs {
  constructor(cfg, log) {
    this.log = log.child({ actor: 'pg' });
    this.cfg = getDbConfig(cfg);
    this.pool = null;
  }

  async connect() {
    this.pool = createPool(this.cfg, this.log);
  }

  async close() {
    await this.pool.end();
  }

  async register(job_id, input_key) {
    const query = 'INSERT INTO jobs (job_id, input) VALUES ($1, $2)';
    const values = [job_id, input_key];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to register job: ${error.message}`);
    }
  }

  async getById(jobId) {
    const query = 'SELECT * FROM jobs WHERE job_id = $1';

    try {
      const result = await this.pool.query(query, [jobId]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Failed to get job: ${error.message}`);
    }
  }

  async getStatuses(options = {}) {
    const { limit = 50, offset = 0, status } = options;

    let query = `
      SELECT 
        job_id,
        status,
        updated_at
      FROM jobs
    `;

    const values = [];
    let paramCount = 0;

    // Add status filter if provided
    if (status) {
      paramCount++;
      query += ` WHERE status = $${paramCount}`;
      values.push(status);
    }

    // Add ordering and pagination
    query += ` ORDER BY updated_at DESC, job_id DESC`;
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    values.push(limit, offset);

    // Count query for total
    let countQuery = `SELECT COUNT(*) as total FROM jobs`;
    const countValues = [];

    if (status) {
      countQuery += ` WHERE status = $1`;
      countValues.push(status);
    }

    try {
      const [jobsResult, countResult] = await Promise.all([
        this.pool.query(query, values),
        this.pool.query(countQuery, countValues),
      ]);

      const jobs = jobsResult.rows;
      const total = parseInt(countResult.rows[0].total);
      const hasMore = offset + limit < total;
      const totalPages = Math.ceil(total / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      return {
        jobs,
        pagination: {
          total,
          limit,
          offset,
          hasMore,
          totalPages,
          currentPage,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get jobs list: ${error.message}`);
    }
  }

  async updateJob(jobId, updates) {
    const allowedFields = ['status', 'output', 'output_cdn_url', 'mc_job_id', 'error_message'];
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    // Build dynamic update query
    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) {
        paramCount++;
        updateFields.push(`${field} = $${paramCount}`);
        values.push(value);
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const query = `
      UPDATE jobs 
      SET ${updateFields.join(', ')}
      WHERE job_id = $${++paramCount}
      RETURNING *
    `;

    values.push(jobId);

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Failed to update job: ${error.message}`);
    }
  }
}
