#!/usr/bin/env bash
set -x

pushd service/api-service
    npm run build
popd

pushd service/mock-emc
    npm run build
popd

pushd service/lambda-ems-event
    rm -rf node_modules
    npm run build
    mv emsEvent.zip ../../test/local
popd

pushd service/lambda-s3-event
    rm -rf node_modules
    npm run build
    mv s3event.zip ../../test/local
popd
