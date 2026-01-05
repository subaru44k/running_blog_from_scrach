Sign Upload Lambda (AWS SDK v3)

Purpose
- Issues a short-lived presigned POST (url + fields) so the browser can upload a PDF directly to S3, bypassing API Gateway/Lambda size limits.

Runtime
- Node.js 20.x

Files
- index.mjs: Lambda handler using `@aws-sdk/client-s3` + `@aws-sdk/s3-presigned-post`.
- package.json: declares v3 dependencies for packaging.

Environment variables
- BUCKET_NAME: target S3 bucket for uploads (required)
- UPLOAD_URL_TTL: URL lifetime in seconds (default 600)

Upload limits
- Maximum upload size: 50MB (enforced by presigned POST policy: content-length-range)
- Clients should send contentLength to pre-check before issuing a presigned POST

Required IAM for the Lambda role
- s3:PutObject on arn:aws:s3:::<BUCKET_NAME>/*

S3 bucket CORS (Console → S3 → Permissions → CORS)
- [
  {
    "AllowedOrigins": ["https://subaru-is-running.com", "http://localhost:4321"],
    "AllowedMethods": ["POST", "PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]

Console setup steps
1) Create S3 bucket (e.g., pdf-compress-uploads-prod) and set CORS as above.
2) IAM → Roles → Create role for Lambda (or reuse) and attach an inline policy:
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject"],
         "Resource": ["arn:aws:s3:::pdf-compress-uploads-prod/*"]
       }
     ]
   }
3) Package and deploy the function
   - cd lambdas/sign-upload-v3
   - npm install --production
   - zip -r function.zip .
   - Lambda → Create function → Author from scratch
     - Name: pdf-sign-upload
     - Runtime: Node.js 20.x
     - Execution role: the role from step 2
     - Create → Code → Upload from → .zip file → upload function.zip → Deploy
4) Set environment variables
   - BUCKET_NAME=pdf-compress-uploads-prod
   - ALLOW_ORIGIN=https://subaru-is-running.com (add localhost if needed)
   - UPLOAD_URL_TTL=600 (optional)
5) API Gateway (HTTP API)
   - Integrations → Create → Lambda → choose pdf-sign-upload → Payload format v2.0
   - Routes → Create: POST /sign-upload → attach the Lambda integration
   - CORS: Configure in API Gateway (recommended); allow your site origins, method POST, header content-type
   - Stage: $default with Auto-deploy ON
6) Test
   - curl -X POST "$API_BASE/sign-upload" -H "content-type: application/json" -d '{"filename":"test.pdf","contentType":"application/pdf","contentLength":1234}'
   - Response includes: { url, fields, objectKey, bucket }
   - POST your file to url with fields + file (multipart/form-data)
