import { test, expect } from '@playwright/test'
import { sendEventComplete, sendEventError } from './utils'

test('smoke healthcheck', async ({ request }) => {
  const ret = await request.get(`/health`, {})
  expect(ret.ok()).toBeTruthy()
})

test('smoke bad path', async ({ request }) => {
  const ret = await request.get(`/foo/bar`, {})
  expect(ret.ok()).toBeFalsy()
})

test('smoke new upload', async ({ request }) => {
  const newUpload = await request.post(`/upload-request`, {})
  expect(newUpload.ok()).toBeTruthy()
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
