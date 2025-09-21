-- Job processing table
CREATE TABLE jobs (
    job_id UUID PRIMARY KEY,
    status VARCHAR(20) NOT NULL CHECK (status IN ('WAITING_FOR_UPLOAD', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')) DEFAULT 'WAITING_FOR_UPLOAD',
    input TEXT,
    output TEXT DEFAULT '',
    output_cdn_url TEXT DEFAULT '',
    mc_job_id VARCHAR(255)  DEFAULT '',
    error_message TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient jobs queries
CREATE INDEX idx_jobs_ids ON jobs(job_id);

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
