#!/bin/sh
set -x

stream=$(aws logs describe-log-streams --log-group-name '/aws/lambda/s3-event-processor' | jq '.logStreams[0].logStreamName' | sed 's/"//g' )
aws logs get-log-events --log-group-name /aws/lambda/s3-event-processor --log-stream-name "$stream"
