set -x
set -e

# Create S3 bucket
aws s3api create-bucket --bucket test-bucket 

# Enable EventBridge notifications for the bucket
aws s3api put-bucket-notification-configuration \
    --bucket test-bucket \
    --notification-configuration '{"EventBridgeConfiguration": {}}'

# Create IAM role for Lambdas
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
aws iam create-role \
  --role-name lambda-role \
  --assume-role-policy-document file://trust-policy.json
rm trust-policy.json

aws iam attach-role-policy \
  --role-name lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Upload s3 event lambda
aws lambda create-function \
  --function-name s3-event-processor \
  --runtime nodejs22.x \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --handler index.handler \
  --zip-file fileb://s3event.zip \
  --timeout 30 \
  --memory-size 128

# Upload MediaConvert event lambda
aws lambda create-function \
  --function-name emc-event-processor \
  --runtime nodejs22.x \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --handler index.handler \
  --zip-file fileb://emsEvent.zip \
  --timeout 30 \
  --memory-size 128

# Create an EventBridge rules to capture S3 & MediaConvert events
aws events put-rule \
  --name s3-create-events \
  --event-pattern '{
    "source": ["aws.s3"],
    "detail-type": ["Object Created"],
    "detail": {
      "bucket": {
        "name": ["test-bucket"]
      }
    }
  }' \
  --description "Capture S3 create events"

aws events put-rule \
  --name emc-events \
  --event-pattern '{
    "source": ["aws.mediaconvert"]
  }' \
  --description "Capture MediaConvert events"

# Add Lambda targets
aws events put-targets \
  --rule s3-create-events \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:000000000000:function:s3-event-processor"

aws events put-targets \
  --rule emc-events \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:000000000000:function:emc-event-processor"

# Add permission for EventBridge to invoke Lambda
aws lambda add-permission \
  --function-name s3-event-processor \
  --statement-id eventbridge-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:000000000000:rule/s3-create-events

aws lambda add-permission \
  --function-name emc-event-processor \
  --statement-id eventbridge-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:000000000000:rule/emc-events
