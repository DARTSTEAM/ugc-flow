#!/usr/bin/env bash
set -euo pipefail

PROJECT="bigquery-388915"
REGION="us-central1"
SERVICE="ugc-flow"

COMMIT_SHA=$(git rev-parse HEAD)

echo "Submitting build to Cloud Build (project: $PROJECT, sha: ${COMMIT_SHA:0:7})..."
gcloud builds submit \
  --config=cloudbuild.yaml \
  --project="$PROJECT" \
  --substitutions="COMMIT_SHA=$COMMIT_SHA" \
  .

echo ""
echo "Done. Cloud Run service '$SERVICE' updated in $REGION."
echo "URL: $(gcloud run services describe $SERVICE --region=$REGION --project=$PROJECT --format='value(status.url)')"
