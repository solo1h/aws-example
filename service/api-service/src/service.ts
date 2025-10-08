import { Logger } from 'winston'
import express, { Application, Request, Response } from 'express'
import * as uuid from 'uuid'
import { Config, ServiceConfig } from './config'
import { Jobs as DbJobs } from './db'
import { S3 } from './aws'

/**
 * API Service class that handles HTTP requests for job management and uploads.
 */
export class UploadApiService {
  private app: Application
  private server: any
  private log: Logger
  private cfg: ServiceConfig
  private db: DbJobs
  private s3: S3

  /**
   * Creates an instance of UploadApiService.
   *
   * @param {Object} config - Configuration object
   * @param {Object} logger - Logger instance
   */
  constructor(config: Config, logger: Logger) {
    this.log = logger
    this.cfg = config.service
    this.db = new DbJobs(config, logger)
    this.s3 = new S3(config, logger)

    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()

    this.server = null
  }

  /**
   * Starts the API service.
   */
  async start(): Promise<void> {
    await this.db.connect()

    this.server = this.app.listen(this.cfg.port, () => {
      this.log.info(`API service started on port ${this.cfg.port}`)
    })
  }

  /**
   * Stops the API service gracefully.
   */
  async stop(): Promise<void> {
    this.log.info('Starting graceful shutdown')

    if (this.server) {
      this.server.close(() => {
        this.log.info('HTTP server closed')
      })
    }

    if (this.db) {
      await this.db.close()
      this.log.info('Database connection closed')
    }
  }

  /**
   * Sets up middleware for the Express app.
   */
  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))
    this.app.use(this.middlewareLogger())
  }

  /**
   * Sets up routes for the Express app.
   */
  private setupRoutes(): void {
    this.app.get('/health', this.getHealth())
    this.app.get('/jobs/:jobId', this.getJobById())
    this.app.get('/jobs', this.getJobStatuses())
    this.app.post('/upload-request', this.postUploadRequest())

    this.app.all('*path', (req: Request, res: Response) => {
      res.status(400).json({
        error: 'Bad request',
        message: 'Invalid path'
      })
    })
  }

  /**
   * Creates a middleware function for logging HTTP requests.
   *
   * @returns {Function} Express middleware function
   */
  private middlewareLogger() {
    const logger = this.log

    return (req: Request, res: Response, next: any) => {
      const start = Date.now()

      res.on('finish', () => {
        const duration = Date.now() - start
        const logData = {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }

        if (res.statusCode >= 400) {
          logger.error('HTTP Request', logData)
        } else {
          logger.debug('HTTP Request', logData)
        }
      })

      next()
    }
  }

  /**
   * Handler for the health check endpoint.
   *
   * @returns {Function} Express request handler
   */
  private getHealth() {
    return async (req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      })
    }
  }

  /**
   * Handler for retrieving a job by its ID.
   *
   * @returns {Function} Express request handler
   */
  private getJobById() {
    const logger = this.log
    const jobs = this.db

    return async (req: Request, res: Response) => {
      try {
        const { jobId } = req.params as { jobId: string }

        if (!uuid.validate(jobId)) {
          return res.status(400).json({
            error: 'Bad request',
            message: 'Invalid job ID format'
          })
        }

        const job = await jobs.getById(jobId)

        if (!job) {
          return res.status(404).json({
            error: 'Not found',
            message: 'Job not found'
          })
        }

        res.status(200).json({
          job_id: job.job_id,
          status: job.status,
          input: job.input,
          output: job.output || null,
          output_cdn: job.output_cdn_url || null,
          mc_job_id: job.mc_job_id || null,
          error_message: job.error_message || null,
          updated_at: job.updated_at
        })
      } catch (error) {
        logger.error('Failed to retrieve job', {
          jobId: req.params.jobId,
          error: error.message,
          stack: error.stack
        })
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to retrieve job'
        })
      }
    }
  }

  /**
   * Handler for retrieving job statuses.
   *
   * @returns {Function} Express request handler
   */
  private getJobStatuses() {
    const logger = this.log
    const jobs = this.db

    return async (req: Request, res: Response) => {
      try {
        // @ts-ignore
        const limit = parseInt(req.query.limit) || 50

        if (limit < 1 || limit > 1000) {
          return res.status(400).json({
            error: 'Bad request',
            message: 'Limit must be between 1 and 1000'
          })
        }

        const statuses = await jobs.getStatuses({ limit })
        res.status(200).json(statuses)
      } catch (error) {
        logger.error('Failed to retrieve jobs list', {
          error: error.message,
          stack: error.stack
        })
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to retrieve jobs list'
        })
      }
    }
  }

  /**
   * Handler for creating upload requests.
   *
   * @returns {Function} Express request handler
   */
  private postUploadRequest() {
    const logger = this.log
    const jobs = this.db
    const s3 = this.s3

    return async (req: Request, res: Response) => {
      try {
        const jobId = uuid.v4()
        const fileName = 'foobar'
        // FIXME: parse body
        // . get fileName
        // . get metadata

        const uploadUrl = await s3.getPresignedUrl(jobId, fileName)
        await jobs.register(jobId, fileName)

        res.status(201).json({
          job_id: jobId,
          upload_url: uploadUrl
        })
      } catch (error) {
        logger.error('Failed to create upload request', {
          error: error.message,
          stack: error.stack
        })
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to create upload request'
        })
      }
    }
  }
}

/**
 * Runs the UploadApiService with given configuration and logger.
 *
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 */
export async function runService(
  config: Config,
  logger: Logger
): Promise<void> {
  const service = new UploadApiService(config, logger)
  await service.start()
}
