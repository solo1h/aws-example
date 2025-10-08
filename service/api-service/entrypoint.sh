#!/bin/sh
node main.js init

if [ $? -eq 0 ]; then
    node main.js serve
else
    exit 1
fi