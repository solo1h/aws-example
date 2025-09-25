#!/bin/sh
node index.js init

if [ $? -eq 0 ]; then
    node index.js serve
else
    exit 1
fi