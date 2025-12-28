# Fitbit OAuth Callback Lambda

Handles the Fitbit OAuth 2.0 authorization callback, exchanges the code for an
access/refresh token pair, and stores the tokens in S3 for later use by the
admin tooling.

## Environment Variables

| Name | Description |
| --- | --- |
| `FITBIT_CLIENT_ID` | Fitbit application client ID |
| `FITBIT_CLIENT_SECRET` | Fitbit application client secret |
| `FITBIT_REDIRECT_URI` | Exact redirect URI registered with Fitbit (must match the API Gateway endpoint) |
| `TOKEN_S3_BUCKET` | Bucket where the token JSON payload is stored |
| `TOKEN_S3_KEY` | Optional key name (default: `fitbit/token.json`) |
| `TOKEN_S3_SSE` | Optional server-side encryption setting (e.g., `aws:kms`) |
| `EXPECTED_STATE` | Optional anti-CSRF state value to validate in the query string |
| `SUCCESS_REDIRECT_URL` | Optional URL to redirect the browser to on success (otherwise a simple confirmation page is rendered) |

Provision the Lambda behind an HTTPS endpoint (e.g., API Gateway HTTP API).
Set the Fitbit app redirect URL to that endpoint (for example
`https://abc123.execute-api.ap-northeast-1.amazonaws.com/fitbit/callback`).

The Lambda saves a JSON document containing the Fitbit user ID, access token,
refresh token, and expiry timestamp. Downstream tooling can use the refresh
token to obtain a new access token when needed.

### Minimal IAM Policy

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET/YOUR_PREFIX*"
    }
  ]
}
```

Add `s3:GetObject` if the Lambda also needs to read previously stored tokens.

### Deploy (manual zip)

```
cd lambdas/fitbit-callback
npm install --production
zip -r ../fitbit-callback.zip .
```

Upload the resulting zip to Lambda (Node.js 20 runtime). Configure the
environment variables above and wire the function to API Gateway.

## CloudFormation Deployment

A reusable CloudFormation template is provided at `cloudformation.yaml`.

1. Package the function:
   ```bash
   cd lambdas/fitbit-callback
   npm install --production
   zip -r function.zip index.mjs package.json node_modules
   aws s3 cp function.zip s3://YOUR_CODE_BUCKET/fitbit-callback/function.zip
   ```
2. Deploy the stack:
   ```bash
   aws cloudformation deploy \
     --template-file cloudformation.yaml \
     --stack-name subaru-fitbit-callback \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       DeploymentPackageBucket=YOUR_CODE_BUCKET \
       DeploymentPackageKey=fitbit-callback/function.zip \
       FitbitClientId=YOUR_CLIENT_ID \
       FitbitClientSecret=YOUR_CLIENT_SECRET \
       FitbitRedirectUri=https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/fitbit/callback \
       TokenS3Bucket=your-secrets-bucket \
       TokenS3Key=fitbit/token.json
   ```
3. Copy the `CallbackUrl` stack output into the Fitbit app configuration
   so the redirect URI matches exactly.

Optional parameters (`ExpectedState`, `SuccessRedirectUrl`, `TokenS3Sse`) can
be set via `--parameter-overrides` as well.

