set -x

# Create IAM role for Lambda
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

# Upload lambda
aws lambda create-function \
    --function-name s3-event-processor \
    --runtime nodejs22.x \
    --role arn:aws:iam::000000000000:role/lambda-role \
    --handler index.handler \
    --zip-file fileb://s3event.zip \
    --timeout 30 \
    --memory-size 128

# Create S3 bucket
aws s3api create-bucket --bucket test-bucket 

# Enable EventBridge notifications for the bucket
aws s3api put-bucket-notification-configuration \
    --bucket test-bucket \
    --notification-configuration '{"EventBridgeConfiguration": {}}'

# Create an EventBridge rule to capture S3 events
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

# Add Lambda function as target
aws events put-targets \
  --rule s3-create-events \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:000000000000:function:s3-event-processor"

# Add permission for EventBridge to invoke Lambda
aws lambda add-permission \
  --function-name s3-event-processor \
  --statement-id eventbridge-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:000000000000:rule/s3-create-events
