-- Job processing table
CREATE TABLE jobs (
    job_id UUID PRIMARY KEY,
    status VARCHAR(20) NOT NULL CHECK (status IN ('WAITING_FOR_UPLOAD', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
    input_path TEXT,
    output_path TEXT,
    output_cdn_url TEXT,
    mc_job_id VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient status queries
CREATE INDEX idx_jobs_status ON jobs(status);

-- Index for efficient time-based queries
CREATE INDEX idx_jobs_updated_at ON jobs(updated_at);

-- Index for mc_job_id lookups (if this is an external system reference)
CREATE INDEX idx_jobs_mc_job_id ON jobs(mc_job_id) WHERE mc_job_id IS NOT NULL;

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_jobs_updated_at 
    BEFORE UPDATE ON jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Example queries
-- Insert a new job (job_id provided externally)
-- INSERT INTO jobs (job_id, status, input_path) VALUES ('550e8400-e29b-41d4-a716-446655440000', 'WAITING_FOR_UPLOAD', 's3://bucket/input/12345/video.mp4');

-- Update job status
-- UPDATE jobs SET status = 'RUNNING' WHERE job_id = '550e8400-e29b-41d4-a716-446655440000';

-- Get jobs by status
-- SELECT * FROM jobs WHERE status = 'FAILED' ORDER BY updated_at DESC;

-- Get job with error details
-- SELECT job_id, status, error_message, updated_at FROM jobs WHERE status = 'FAILED';

-- Paginated queries (using LIMIT/OFFSET)
-- Get jobs with pagination (page 1, 20 items per page)
-- SELECT * FROM jobs ORDER BY updated_at DESC LIMIT 20 OFFSET 0;

-- Get jobs with pagination (page 2, 20 items per page)  
-- SELECT * FROM jobs ORDER BY updated_at DESC LIMIT 20 OFFSET 20;

-- More efficient cursor-based pagination using updated_at + job_id
-- First page (no cursor)
-- SELECT * FROM jobs ORDER BY updated_at DESC, job_id DESC LIMIT 20;

-- Subsequent pages (using last row from previous page as cursor)
-- SELECT * FROM jobs 
-- WHERE (updated_at, job_id) < ('2024-01-15 10:30:00+00', '550e8400-e29b-41d4-a716-446655440000')
-- ORDER BY updated_at DESC, job_id DESC LIMIT 20;