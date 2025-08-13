const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

function headerLookup(headers, key) {
  if (!headers) return undefined;
  const found = Object.keys(headers).find((k) => k.toLowerCase() === key.toLowerCase());
  return found ? headers[found] : undefined;
}

function mapLevel(level) {
  const lvl = Number(level);
  if (lvl === 1) return { preset: '/printer', colorRes: 300, grayRes: 300, monoRes: 600 };
  if (lvl === 3) return { preset: '/screen', colorRes: 72, grayRes: 72, monoRes: 300 };
  return { preset: '/ebook', colorRes: 150, grayRes: 150, monoRes: 300 };
}

function runGs(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('gs', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve(null);
      else reject(new Error(`Ghostscript failed (${code}): ${stderr}`));
    });
  });
}

// Minimal multipart/form-data parser for single file field + text fields
function parseMultipart(bodyBuf, contentType) {
  const m = /boundary=(.*)$/i.exec(contentType || '');
  if (!m) throw new Error('Missing boundary in Content-Type');
  const boundary = '--' + m[1];
  const parts = bodyBuf.toString('binary').split(boundary);
  const fields = {};
  let file = null;
  for (const part of parts) {
    if (!part || part === '--\r\n' || part === '--') continue;
    const [rawHeaders, rawBody] = part.split('\r\n\r\n');
    if (!rawHeaders || !rawBody) continue;
    const headerLines = rawHeaders.split('\r\n').filter(Boolean);
    const dispLine = headerLines.find((l) => /^content-disposition:/i.test(l));
    if (!dispLine) continue;
    const nameMatch = /name="([^"]+)"/i.exec(dispLine);
    const fileMatch = /filename="([^"]+)"/i.exec(dispLine);
    const bodyBinary = rawBody.slice(0, -2); // drop trailing \r\n
    if (fileMatch) {
      file = {
        filename: fileMatch[1],
        buffer: Buffer.from(bodyBinary, 'binary'),
      };
    } else if (nameMatch) {
      fields[nameMatch[1]] = Buffer.from(bodyBinary, 'binary').toString('utf8');
    }
  }
  return { fields, file };
}

exports.handler = async (event) => {
  try {
    const isApiGwV2 = !!event.version; // HTTP API v2.0
    const headers = event.headers || {};
    const contentType = headerLookup(headers, 'content-type') || headerLookup(headers, 'Content-Type') || '';

    let fileBuf, filename, level, removeMetadata, grayscale, s3Bucket, s3Key, wantDownloadUrl;

    if (/multipart\/form-data/i.test(contentType)) {
      if (!event.isBase64Encoded) throw new Error('Multipart body must be base64-encoded');
      const bodyBuf = Buffer.from(event.body || '', 'base64');
      const { file, fields } = parseMultipart(bodyBuf, contentType);
      if (!file) throw new Error('Missing multipart file field');
      fileBuf = file.buffer;
      filename = file.filename || 'input.pdf';
      level = fields.level || '2';
      removeMetadata = String(fields.removeMetadata || 'false') === 'true';
      grayscale = String(fields.grayscale || 'false') === 'true';
      wantDownloadUrl = false;
    } else {
      // Expect JSON: either
      //  - { fileBase64, filename?, level?, removeMetadata?, grayscale? }
      //  - { bucket, key, level?, removeMetadata?, grayscale? }
      const bodyStr = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
      const data = bodyStr ? JSON.parse(bodyStr) : {};
      level = data.level || '2';
      removeMetadata = !!data.removeMetadata;
      grayscale = !!data.grayscale;
      if (data.bucket && data.key) {
        s3Bucket = data.bucket;
        s3Key = data.key;
        wantDownloadUrl = true;
      } else if (data.fileBase64) {
        fileBuf = Buffer.from(data.fileBase64, 'base64');
        filename = data.filename || 'input.pdf';
        wantDownloadUrl = false;
      } else {
        throw new Error('Missing fileBase64 or bucket/key in JSON body');
      }
    }

    const { preset, colorRes, grayRes, monoRes } = mapLevel(level);
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'gs-'));
    const inFile = path.join(tmpDir, 'in.pdf');
    const outFile = path.join(tmpDir, 'out.pdf');
    if (s3Bucket && s3Key) {
      const s3 = new S3Client({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });
      const obj = await s3.send(new GetObjectCommand({ Bucket: s3Bucket, Key: s3Key }));
      const chunks = [];
      await new Promise((resolve, reject) => {
        obj.Body.on('data', (c) => chunks.push(c));
        obj.Body.on('end', resolve);
        obj.Body.on('error', reject);
      });
      const buf = Buffer.concat(chunks);
      await fsp.writeFile(inFile, buf);
      filename = path.basename(s3Key);
    } else {
      await fsp.writeFile(inFile, fileBuf);
    }

    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${outFile}`,
      `-dPDFSETTINGS=${preset}`,
      '-dDetectDuplicateImages=true',
      '-dCompressFonts=true',
      '-dColorImageDownsampleType=/Bicubic',
      `-dColorImageResolution=${colorRes}`,
      '-dGrayImageDownsampleType=/Bicubic',
      `-dGrayImageResolution=${grayRes}`,
      '-dMonoImageDownsampleType=/Subsample',
      `-dMonoImageResolution=${monoRes}`,
    ];
    if (grayscale) {
      args.push('-sColorConversionStrategy=Gray', '-dProcessColorModel=/DeviceGray', '-dConvertCMYKImagesToRGB=true');
    }
    if (removeMetadata) {
      args.push('-dPreserveDocumentInfo=false', '-sTitle=', '-sAuthor=', '-sSubject=', '-sKeywords=', '-sCreator=', '-sProducer=');
    }
    args.push(inFile);

    await runGs(args);

    const outBuf = await fsp.readFile(outFile);
    const base = (filename || 'output.pdf').replace(/\.pdf$/i, '');

    if (wantDownloadUrl && s3Bucket) {
      const s3 = new S3Client({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });
      const outKey = `outputs/${base}.compressed.pdf`;
      await s3.send(new PutObjectCommand({ Bucket: s3Bucket, Key: outKey, Body: outBuf, ContentType: 'application/pdf' }));
      // Best-effort: delete original upload to save storage cost
      try {
        if (s3Key && /^uploads\//.test(s3Key)) {
          await s3.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: s3Key }));
        }
      } catch (e) {
        // Ignore deletion errors; do not fail compression response
      }
      const downloadUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: s3Bucket, Key: outKey }), { expiresIn: Number(process.env.DOWNLOAD_URL_TTL || 600) });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: s3Bucket, key: outKey, downloadUrl }),
      };
    } else {
      const bodyBase64 = outBuf.toString('base64');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${base}.compressed.pdf"`,
        },
        isBase64Encoded: true,
        body: bodyBase64,
      };
    }
  } catch (err) {
    const msg = String((err && err.message) || err);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Compression failed', detail: msg }),
    };
  }
};
