const { PutObjectCommand } = require('@aws-sdk/client-s3');

async function saveFitbitTokens({
  s3,
  bucket,
  key,
  tokens,
  serverSideEncryption,
  now = () => new Date(),
}) {
  const payload = {
    ...tokens,
    saved_at: now().toISOString(),
  };

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(payload, null, 2),
    ContentType: 'application/json',
    ServerSideEncryption: serverSideEncryption || undefined,
  }));

  return payload;
}

module.exports = {
  saveFitbitTokens,
};
