#!/usr/bin/env bash
set -e

echo "Init NodeJS projects..."
echo "---"
for dir in ./service/*; do
  if [ -d "$dir" ]; then
    pushd ${dir}
      echo "> $dir"
      npm i
    popd
  fi
done

echo "---"
echo "> ./test/local"
pushd ./test/local
  npm i
popd

echo "---"
echo "Pull Docker images..."
docker pull dpage/pgadmin4
docker pull postgres
docker pull localstack/localstack
docker pull amazon/aws-cli