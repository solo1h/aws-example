#!/usr/bin/env bash
set -x

pushd service/api-service
    npm run build
popd

pushd service/mock-emc
    npm run build
popd

pushd service/lambda-emc-event
    rm -rf node_modules
    npm run build
    mv emcEvent.zip ../../test/local
popd

pushd service/lambda-s3-event
    rm -rf node_modules
    npm run build
    mv s3event.zip ../../test/local
popd
