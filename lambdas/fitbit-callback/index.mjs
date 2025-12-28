import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const REQUIRED_ENV = [
  'FITBIT_CLIENT_ID',
  'FITBIT_CLIENT_SECRET',
  'FITBIT_REDIRECT_URI',
  'TOKEN_S3_BUCKET',
];

const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length) {
  console.warn(`Missing required env vars: ${missing.join(', ')}`);
}

const s3 = new S3Client({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });

function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function htmlResponse(statusCode, html, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
    body: html,
  };
}

function buildSuccessHtml(message) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Fitbit Connected</title><style>body{font-family:system-ui, sans-serif;background:#f6f6f9;color:#111;padding:3rem;}main{max-width:460px;margin:auto;background:#fff;border-radius:1rem;box-shadow:0 12px 30px rgba(32,45,75,0.14);padding:2.5rem;}h1{font-size:1.7rem;margin-bottom:1rem;}p{line-height:1.5;margin-top:0.8rem;}</style></head><body><main><h1>Fitbit Connected</h1><p>${message}</p><p>You can close this window.</p></main></body></html>`;
}

export const handler = async (event) => {
  try {
    const bucket = process.env.TOKEN_S3_BUCKET;
    const key = process.env.TOKEN_S3_KEY || 'fitbit/token.json';
    const clientId = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    const redirectUri = process.env.FITBIT_REDIRECT_URI;
    const expectedState = process.env.EXPECTED_STATE;
    const successRedirect = process.env.SUCCESS_REDIRECT_URL;

    if (!bucket || !clientId || !clientSecret || !redirectUri) {
      return jsonResponse(500, { error: 'Server missing configuration' });
    }

    const query = event?.queryStringParameters || {};
    const error = query.error || query.error_description;
    if (error) {
      console.error('Fitbit returned error', error);
      return htmlResponse(400, buildSuccessHtml(`Authorization failed: ${error}`));
    }

    const code = query.code;
    if (!code) {
      return jsonResponse(400, { error: 'Missing authorization code' });
    }

    if (expectedState && query.state !== expectedState) {
      console.warn('State mismatch', { expectedState, received: query.state });
      return htmlResponse(400, buildSuccessHtml('Authorization failed: state mismatch.'));
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });

    const tokenRes = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error('Failed to exchange token', tokenRes.status, text);
      return htmlResponse(500, buildSuccessHtml('Authorization failed while exchanging tokens.'));
    }

    const tokenJson = await tokenRes.json();
    const now = Date.now();
    const expiresInMs = (tokenJson.expires_in || 0) * 1000;
    const expiresAt = now + expiresInMs;

    const payload = {
      saved_at: new Date(now).toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
      client_id: clientId,
      scope: tokenJson.scope,
      token_type: tokenJson.token_type,
      user_id: tokenJson.user_id,
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
    };

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(payload, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: process.env.TOKEN_S3_SSE || undefined,
    }));

    if (successRedirect) {
      return {
        statusCode: 302,
        headers: {
          Location: successRedirect,
          'Cache-Control': 'no-store',
        },
        body: '',
      };
    }

    return htmlResponse(200, buildSuccessHtml('Authorization successful. Tokens saved to AWS.'));
  } catch (err) {
    console.error('Callback handler error', err);
    return jsonResponse(500, { error: 'Unexpected error', detail: err instanceof Error ? err.message : String(err) });
  }
};
