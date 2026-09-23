#!/bin/bash
set -e

# Define AWS parameters (Set AWS_DEFAULT_REGION & AWS_ACCOUNT_ID or fetch from metadata)
AWS_REGION=${AWS_REGION:-"ap-south-1"}
IMAGE_REPO_NAME=${IMAGE_REPO_NAME:-"cadence-backend-nest"}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "Logging in to AWS ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

echo "Pulling latest Docker image from ECR..."
docker pull ${ECR_REGISTRY}/${IMAGE_REPO_NAME}:latest

echo "Running updated backend-nest container..."
docker run -d \
  --name cadence-backend-nest \
  --restart unless-stopped \
  -p 4000:4000 \
  --env-file /home/ubuntu/.env \
  ${ECR_REGISTRY}/${IMAGE_REPO_NAME}:latest

echo "Pruning old Docker images (keeping only the 2 most recent images to save disk memory)..."
docker image prune -f

# Remove any Docker images beyond the 2 most recent ones
docker images --format "{{.ID}}" | tail -n +3 | xargs -r docker rmi -f || true

echo "Deployment completed successfully!"
