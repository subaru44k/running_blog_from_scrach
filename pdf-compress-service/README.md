PDF Compress Service (Ghostscript)

Overview
- Compress PDFs using Ghostscript in an AWS Lambda container image.
- Handler: `lambda.js` shells out to Ghostscript and returns a PDF.

Build (Lambda image)
- docker build -t pdf-compress-service ./pdf-compress-service

Run locally (invoke Lambda handler)
- docker run --rm -p 9000:8080 pdf-compress-service
- Invoke with JSON (API Gateway-style):
  - curl -s -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
    -H "content-type: application/json" \
    -d '{"headers":{"content-type":"application/json"},"isBase64Encoded":false,"body":{"fileBase64":"<base64>","filename":"input.pdf","level":2,"removeMetadata":true,"grayscale":false}}'

Lambda request formats supported
- JSON body (S3 mode, recommended for large files):
  - { bucket: string, key: string, level?: 1|2|3, removeMetadata?: boolean, grayscale?: boolean }
  - Response: { bucket, key, downloadUrl }
- JSON body (inline base64 mode):
  - { fileBase64: string, filename?: string, level?: 1|2|3, removeMetadata?: boolean, grayscale?: boolean }
  - Response: application/pdf (base64) with Content-Type application/pdf
- API Gateway proxy with multipart/form-data (base64-encoded body)

Examples
- JSON: use snippet above; capture response body base64 and write to file.
- Multipart via API Gateway: set binary media types and send as base64.

Implementation details
- Base image: node:20-alpine; installs Ghostscript via apk.
- Ghostscript flags:
  - -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/{screen|ebook|printer}
  - Downsampling tuned per level (color/gray/mono resolutions).
  - Grayscale: -sColorConversionStrategy=Gray -dProcessColorModel=/DeviceGray.
  - Metadata removal: best-effort using -dPreserveDocumentInfo=false.

Notes
- Compression defaults are practical; adjust Ghostscript args as needed.
- For S3 mode, the Lambda execution role must have s3:GetObject and s3:PutObject on your bucket.
- This image targets Lambda; Node dependencies (AWS SDK v3) are included in the image.
