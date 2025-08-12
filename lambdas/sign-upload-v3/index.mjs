import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET = process.env.BUCKET_NAME;
const EXPIRES_SECONDS = Number(process.env.UPLOAD_URL_TTL || 600);
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

const s3 = new S3Client({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });

function parseEventBody(event) {
  if (!event || event.body == null) return {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function sanitizeFilename(name = 'upload.pdf') {
  const base = String(name).replace(/[^A-Za-z0-9._-]/g, '_').slice(-120) || 'upload.pdf';
  return base.endsWith('.pdf') ? base : `${base}.pdf`;
}

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || 'POST';
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': ALLOW_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST',
      },
      body: ''
    };
  }

  if (!BUCKET) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': ALLOW_ORIGIN },
      body: JSON.stringify({ error: 'Server not configured: BUCKET_NAME missing' }),
    };
  }

  try {
    const { filename, contentType } = parseEventBody(event);
    const safeName = sanitizeFilename(filename);
    const objectKey = `uploads/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      ContentType: contentType || 'application/pdf',
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: EXPIRES_SECONDS });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': ALLOW_ORIGIN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uploadUrl, objectKey, bucket: BUCKET, expiresIn: EXPIRES_SECONDS }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': ALLOW_ORIGIN },
      body: JSON.stringify({ error: 'Failed to create upload URL', detail: String(err && err.message || err) }),
    };
  }
};

