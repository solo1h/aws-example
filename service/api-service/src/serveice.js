import express from 'express';
import * as uuid from 'uuid';
import { Jobs as DbJobs } from './utils/db.js';
import { S3 } from './utils/aws.js';

export function getServiceConfig(cfg) {
  return {
    port: parseInt(cfg.servicePort),
    apiVersion: cfg.serviceApi,
  };
}

export class UploadApiService {
  constructor(config, logger) {
    this.log = logger;
    this.cfg = getServiceConfig(config);
    this.db = new DbJobs(config, logger);
    this.s3 = new S3(config, logger);

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();

    this.server = null;
  }

  async start() {
    await this.db.connect();

    this.server = this.app.listen(this.cfg.port, () => {
      this.log.info(`API service started on port ${this.cfg.port}`);
    });
  }

  async stop() {
    this.log.info('Starting graceful shutdown');

    if (this.server) {
      this.server.close(() => {
        this.log.info('HTTP server closed');
      });
    }

    if (this.db) {
      await this.db.close();
      this.log.info('Database connection closed');
    }
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(this.middlewareLogger());
  }

  setupRoutes() {
    this.app.get('/health', this.getHealth());
    this.app.get('/api/v1/jobs/:jobId', this.getJobById());
    this.app.get('/api/v1/jobs', this.getJobStatuses());
    this.app.post('/api/v1/upload-request', this.postUploadRequest());

    this.app.all('*path', (req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: 'Endpoint not found',
      });
    });
  }

  middlewareLogger() {
    const logger = this.log;

    return (req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        };

        if (res.statusCode >= 400) {
          logger.error('HTTP Request', logData);
        } else {
          logger.debug('HTTP Request', logData);
        }
      });

      next();
    };
  }

  getHealth() {
    return async (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
      });
    };
  }

  getJobById() {
    const logger = this.log;
    const jobs = this.db;

    return async (req, res) => {
      try {
        const { jobId } = req.params;

        if (!uuid.validate(jobId)) {
          return res.status(400).json({
            error: 'Bad request',
            message: 'Invalid job ID format',
          });
        }

        const job = await jobs.getById(jobId);

        if (!job) {
          return res.status(404).json({
            error: 'Not found',
            message: 'Job not found',
          });
        }

        res.status(200).json({
          job_id: job.job_id,
          status: job.status,
          input: job.input,
          output: job.output || null,
          output_cdn: job.output_cdn_url || null,
          mc_job_id: job.mc_job_id || null,
          error_message: job.error_message || null,
          updated_at: job.updated_at,
        });
      } catch (error) {
        logger.error('Failed to retrieve job', {
          jobId: req.params.jobId,
          error: error.message,
          stack: error.stack,
        });
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to retrieve job',
        });
      }
    };
  }

  getJobStatuses() {
    const logger = this.log;
    const jobs = this.db;

    return async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;

        if (limit < 1 || limit > 1000) {
          return res.status(400).json({
            error: 'Bad request',
            message: 'Limit must be between 1 and 1000',
          });
        }

        const statuses = await jobs.getStatuses({ limit });
        res.status(200).json(statuses);
      } catch (error) {
        logger.error('Failed to retrieve jobs list', {
          error: error.message,
          stack: error.stack,
        });
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to retrieve jobs list',
        });
      }
    };
  }

  postUploadRequest() {
    const logger = this.log;
    const jobs = this.db;
    const s3 = this.s3;

    return async (req, res) => {
      try {
        const jobId = uuid.v4();
        const fname = 'foobar';
        // FIXME: parse body
        // . get fname
        // . get metadata

        const uploadUrl = await s3.getPresignedUrl(jobId, fname);
        await jobs.register(jobId);

        res.status(200).json({
          job_id: jobId,
          upload_url: uploadUrl,
        });
      } catch (error) {
        logger.error('Failed to create upload request', {
          error: error.message,
          stack: error.stack,
        });
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to create upload request',
        });
      }
    };
  }
}

export async function runService(config, logger) {
  const service = new UploadApiService(config, logger);
  await service.start();
}
