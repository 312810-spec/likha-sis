# Deploying pagasa-sync

This is a Cloud Run service, not a Firebase Function -- it needs a JRE
for @pagasa-parser/source-pdf, which Firebase's standard Node buildpack
can't provide. Deploy manually (one-time setup + redeploy on changes):

## One-time setup

    gcloud run deploy pagasa-sync \
      --source functions/pagasa-sync \
      --region asia-southeast1 \
      --no-allow-unauthenticated \
      --project likha-sis

    # Create a dedicated service account for Cloud Scheduler to call this
    # service with, and grant it Cloud Run Invoker on this service:
    gcloud iam service-accounts create pagasa-sync-invoker \
      --project likha-sis
    gcloud run services add-iam-policy-binding pagasa-sync \
      --region asia-southeast1 \
      --member="serviceAccount:pagasa-sync-invoker@likha-sis.iam.gserviceaccount.com" \
      --role="roles/run.invoker"

    # Schedule it every 30 minutes:
    gcloud scheduler jobs create http pagasa-sync-job \
      --schedule="*/30 * * * *" \
      --uri="$(gcloud run services describe pagasa-sync --region asia-southeast1 --format='value(status.url)')" \
      --http-method=POST \
      --oidc-service-account-email="pagasa-sync-invoker@likha-sis.iam.gserviceaccount.com" \
      --location=asia-southeast1 \
      --project likha-sis

## Redeploy after code changes

    gcloud run deploy pagasa-sync --source functions/pagasa-sync --region asia-southeast1 --project likha-sis
