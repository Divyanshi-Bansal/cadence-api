#!/bin/bash
# Stop running container before deployment
echo "Stopping existing backend-nest container if running..."
docker stop cadence-backend-nest || true
docker rm cadence-backend-nest || true
