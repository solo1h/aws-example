# Local Testing Example of an AWS-Deployable API Service

## Service Blueprint

The service implements asynchronous media processing capabilities,
enabling clients to upload media files and receive processed content
through an AWS cloud infrastructure.

**Processing Workflow:**
1. Client requests a media upload link and uploads media files directly to S3 storage
2. The system processes the uploaded media file according to specified processing settings
3. Processed content is then distributed through CloudFront CDN for optimal delivery

![AWS Infra](./docs/AWS.png "AWS Infrastructure Diagram")

## Proof of Concept Implementation

The PoC implementation focuses on covering the main components
of the media processing pipeline:

1. **API Service** - Handles client requests and responses with upload URLs
2. **S3 Event Processing Lambda** - Handels file upload events in S3 and triggers EMC jobs
3. **EMC Event Processing Lambda** - Handels EMC events and updates Job records
4. **AWS IaC Draft** - Provides the foundational infrastructure template for AWS CloudFormation

*Elemental MediaConvert* is not available in *AWS Free Tier* and *Localstack Free Plan*,
so **it's mocked locally** and **skipped in the IaC** configuration.

*CloudFront* is not available in *Localstack Free Plan* and is omitted for PoC simplicity.

*API Gateway* is omitted locally and replaced with *Internet Gateway*
in the IaC config for PoC simplicity.

## Local Setup and Testing Environment

### Prerequisites
- `bash` shell environment
- Node Version Manager (`nvm`) with Node.js installed
- Docker + Compose for builds and local testing
- Free localhost TCP ports `5432`, `4567`, `3001` and `8000` for local testing

### Overview

Source code of the service - `service/*`

Testing - `test/local` 
- `tests/example.spec.ts` - Playwright API tests
- `scripts/init-stack.sh` - Localstack init
- `scripts/laws` - local AWS CLI for debugging

AWS CloudFormation config - `iac/test-aws-stack.yml`

### Setup Process

Run `nvm use` in the project roon, and then - `init.sh` script
to install NPM dependencies and pull docker images.

Run the `build.sh` script to build and package all artifacts:
- `api-service:latest` - Local Docker image containing the API service
- `mock-emc:latest` - Local Docker image with EMC mock
- `test/local/s3event.zip` - S3 event processing Lambda
- `test/local/emcEvent.zip` - EMC event processing Lambda

### Local Testing

1. Navigate to the `test/local` directory
2. Run `docker compose up` to spin up all containerized services and wait for the `aws-init` container to complete its initialization process
3. Run API and happy path tests with `npm test`
4. Release the stack in the end with `docker compose down`

## AWS Deployment

️Current IaC configuration is a draft created for demo purposes only.
It is **not secure**. 

⚠️ **Deploy at your own risk.** ⚠️ 

1. Deploy the stack `iac/test-aws-stack.yml` with CloudFormation.
2. Upload `api-service:latest` image to *ECR*
3. Run an *ECS* service with the stack *ALB*, *Listner*, *TargetGroup*, *ECS TG*, and private network.

API endpoint should be accessible on *ALB Hostname* port 3000.

```bash
# Request an upload URL
curl -X POST http://your.alb.hostname:3000/upload-request

# Upload a file
curl -v -X PUT -T ./your.file -H "Content-Type: text/plain" https://upload_url.from/the/first/response

# Get Job status
curl http://your.alb.hostname:3000/jobs/uuid-from-the-first-response

# Get the list of jobs
curl http://your.alb.hostname:3000/jobs
```