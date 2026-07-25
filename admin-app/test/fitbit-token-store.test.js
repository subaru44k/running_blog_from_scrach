const test = require('node:test');
const assert = require('node:assert/strict');
const { saveFitbitTokens } = require('../lib/fitbit-token-store');

test('persists rotated Fitbit tokens independently of content dry-run behavior', async () => {
  const commands = [];
  const s3 = {
    async send(command) {
      commands.push(command);
    },
  };
  const tokens = {
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
    expires_at: '2026-07-26T10:00:00.000Z',
  };

  const payload = await saveFitbitTokens({
    s3,
    bucket: 'token-bucket',
    key: 'fitbit/token.json',
    tokens,
    serverSideEncryption: 'AES256',
    now: () => new Date('2026-07-26T02:00:00.000Z'),
  });

  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0].input, {
    Bucket: 'token-bucket',
    Key: 'fitbit/token.json',
    Body: JSON.stringify(payload, null, 2),
    ContentType: 'application/json',
    ServerSideEncryption: 'AES256',
  });
  assert.deepEqual(payload, {
    ...tokens,
    saved_at: '2026-07-26T02:00:00.000Z',
  });
});
