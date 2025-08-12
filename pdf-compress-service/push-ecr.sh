#!/usr/bin/env bash
set -euo pipefail

# Push the pdf-compress-service image to ECR.
# Requirements:
# - AWS CLI v2 configured with credentials having ECR permissions
# - Docker (and buildx for multi-arch builds)

AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-}
AWS_REGION=${AWS_REGION:-ap-northeast-1}
ECR_REPO=${ECR_REPO:-pdf-compress-service}
IMAGE_TAG=${IMAGE_TAG:-v0.1.0}
PLATFORM=${PLATFORM:-linux/amd64} # use linux/arm64 for Graviton Lambda

if [[ -z "$AWS_ACCOUNT_ID" ]]; then
  echo "ERROR: Set AWS_ACCOUNT_ID env var (e.g., 123456789012)" >&2
  exit 1
fi

ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO"

echo "Logging in to ECR: $AWS_REGION"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "Ensuring ECR repo exists: $ECR_REPO"
aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$AWS_REGION" >/dev/null 2>&1 || \
  aws ecr create-repository --repository-name "$ECR_REPO" --image-scanning-configuration scanOnPush=true --region "$AWS_REGION"

echo "Building image for platform: $PLATFORM"
docker buildx build \
  --platform "$PLATFORM" \
  -t "$ECR_URI:$IMAGE_TAG" \
  -t "$ECR_URI:latest" \
  ./pdf-compress-service

echo "Pushing: $ECR_URI:$IMAGE_TAG and :latest"
docker push "$ECR_URI:$IMAGE_TAG"
docker push "$ECR_URI:latest"

echo "Done. Image tags:"
echo "  $ECR_URI:$IMAGE_TAG"
echo "  $ECR_URI:latest"

