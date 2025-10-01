#!/bin/sh
set -x

url=$(curl -X POST http://api:3000/upload-request | jq .upload_url | sed 's/"//g')
curl -v -X PUT -T ./test-data -H "Content-Type: text/plain" $url
