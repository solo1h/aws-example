import { test, expect } from '@playwright/test'
import { sendEventComplete, sendEventError } from './utils'
import { validate as validUuid, v4 as uuidv4 } from 'uuid'

test('smoke healthcheck', async ({ request }) => {
  const ret = await request.get(`/health`, {})
  expect(ret.ok()).toBeTruthy()

  const body = await ret.json()
  expect(body).toHaveProperty('status', 'healthy')
  expect(body).toHaveProperty('timestamp')
  expect(body).toHaveProperty('uptime')
  expect(body).toHaveProperty('version')
  expect(typeof body.uptime).toBe('number')
  expect(body.uptime).toBeGreaterThan(0)
  // Validate ISO timestamp format
  const timestamp = new Date(body.timestamp)
  expect(timestamp.toISOString()).toBe(body.timestamp)
})

test('should handle multiple concurrent requests', async ({ request }) => {
  const promises = Array(10)
    .fill(null)
    .map(() => request.get('/health'))

  const ret = await Promise.all(promises)

  ret.forEach((response) => {
    expect(response.status()).toBe(200)
  })
})

test('smoke invalid path', async ({ request }) => {
  const ret = await request.get(`/foo/bar`, {})
  expect(ret.status()).toBe(400)

  const body = await ret.json()
  expect(body).toHaveProperty('error', 'Bad request')
  expect(body).toHaveProperty('message', 'Invalid path')
})

test('smoke new upload', async ({ request }) => {
  const ret = await request.post(`/upload-request`, {})
  expect(ret.status()).toBe(201)

  const body = await ret.json()
  expect(body).toHaveProperty('job_id')
  expect(validUuid(body.job_id)).toBeTruthy()
  expect(body).toHaveProperty('upload_url')
  expect(body.upload_url.length).toBeGreaterThan(0)
  new URL(body.upload_url) // invalid URL thow a error

  const job = await request.get(`/jobs/${body.job_id}`)
  expect(job.status()).toBe(200)

  const jobBody = await job.json()
  expect(jobBody).toHaveProperty('job_id', body.job_id)
  expect(jobBody).toHaveProperty('status')
  expect(jobBody).toHaveProperty('input')
  expect(jobBody).toHaveProperty('output')
  expect(jobBody).toHaveProperty('output_cdn')
  expect(jobBody).toHaveProperty('mc_job_id')
  expect(jobBody).toHaveProperty('error_message')
  expect(jobBody).toHaveProperty('updated_at')
  // Validate timestamp format
  const timestamp = new Date(jobBody.updated_at)
  expect(timestamp.toISOString()).toBe(jobBody.updated_at)
})

test('smoke upload large data', async ({ request }) => {
  const data = {
    filename: 'test.txt',
    metadata: {
      description: 'a'.repeat(1000000),
      tags: Array(100).fill('tag'),
    },
  }

  const ret = await request.post(`/upload-request`, { data })
  expect(ret.status()).toBe(201)
})

test('smoke return 404 for non-existent job ID', async ({ request }) => {
  const nonExistentJobId = uuidv4()
  const ret = await request.get(`/jobs/${nonExistentJobId}`)
  expect(ret.status()).toBe(404)

  const body = await ret.json()
  expect(body).toHaveProperty('error', 'Not found')
  expect(body).toHaveProperty('message', 'Job not found')
})

test('smoke handle special characters in job ID path', async ({ request }) => {
  const specialCharJobId = 'job@#$%'
  const ret = await request.get(`/jobs/${specialCharJobId}`)
  expect(ret.status()).toBe(400)

  const body = await ret.json()
  expect(body).toHaveProperty('error', 'Bad request')
  expect(body).toHaveProperty('message', 'Invalid job ID format')
})

test('smoke handle custom headers', async ({ request }) => {
  const headers = {
    'User-Agent': 'Custom-Test-Agent/1.0',
    'X-Custom-Header': 'test-value',
    'X-Request-ID': uuidv4(),
  }

  let ret = await request.get(`/health`, { headers })
  expect(ret.ok()).toBeTruthy()

  ret = await request.get(`/jobs`, { headers })
  expect(ret.ok()).toBeTruthy()

  ret = await request.post(`/upload-request`, { headers })
  expect(ret.status()).toBe(201)
})

test('happy path', async ({ request }) => {
  // create a new Job
  const newUpload = await request.post(`/upload-request`, {})
  expect(newUpload.ok()).toBeTruthy()

  const { job_id, upload_url } = await newUpload.json()

  // test status of new job
  const newJob = await request.get(`/jobs/${job_id!}`)
  expect(newJob.ok()).toBeTruthy()

  let jobInfo = await newJob.json()
  expect(jobInfo.status!).toBe('WAITING_FOR_UPLOAD')

  // upload a file to s3
  const fix_url = upload_url.replace('localstack:4566', 'localhost:4567')
  const ret = await request.put(fix_url, {
    headers: { 'Content-Type': 'text/plain' },
    data: 'XXXX',
  })
  expect(ret.ok()).toBeTruthy()

  // sleep 3s and get status
  await new Promise((resolve) => setTimeout(resolve, 3000))
  const queuedJob = await request.get(`/jobs/${job_id}`)
  expect(queuedJob.ok()).toBeTruthy()
  jobInfo = await queuedJob.json()
  expect(jobInfo.status!).toBe('QUEUED')

  // send EMC event failed
  await sendEventError(jobInfo.mc_job_id, 1040, 'Some eroor')
  await new Promise((resolve) => setTimeout(resolve, 3000))
  const failedJob = await request.get(`/jobs/${job_id}`)
  expect(failedJob.ok()).toBeTruthy()
  jobInfo = await failedJob.json()
  expect(jobInfo.status!).toBe('FAILED')

  // send EMC event complete
  await sendEventComplete(jobInfo.mc_job_id, 'some_output_path')
  await new Promise((resolve) => setTimeout(resolve, 3000))
  const completeJob = await request.get(`/jobs/${job_id}`)
  expect(completeJob.ok()).toBeTruthy()
  jobInfo = await completeJob.json()
  expect(jobInfo.status!).toBe('SUCCEEDED')
})
