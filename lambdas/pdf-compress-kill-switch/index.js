const {
  S3Client,
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
  DeleteBucketPolicyCommand,
} = require('@aws-sdk/client-s3');
const { SSMClient, PutParameterCommand } = require('@aws-sdk/client-ssm');

const s3 = new S3Client({});
const ssm = new SSMClient({});

const TARGET_BUCKET = process.env.TARGET_BUCKET;
const KILL_SWITCH_SID =
  process.env.KILL_SWITCH_SID || 'KillSwitchDenyGetOutputsPreviews';
const SSM_ENABLED_PARAM =
  process.env.SSM_ENABLED_PARAM || '/pdf-compress/kill-switch/enabled';
const SSM_LAST_TRIGGERED_PARAM =
  process.env.SSM_LAST_TRIGGERED_PARAM || '/pdf-compress/kill-switch/lastTriggered';

const DENY_STATEMENT = (bucket) => ({
  Sid: KILL_SWITCH_SID,
  Effect: 'Deny',
  Principal: '*',
  Action: ['s3:GetObject'],
  Resource: [
    `arn:aws:s3:::${bucket}/outputs/*`,
    `arn:aws:s3:::${bucket}/previews/*`,
  ],
});

function parseMode(event) {
  if (event && typeof event.mode === 'string') return event.mode;
  if (event && Array.isArray(event.Records) && event.Records[0]?.Sns?.Message) {
    const msg = event.Records[0].Sns.Message;
    try {
      const parsed = JSON.parse(msg);
      if (parsed && typeof parsed.mode === 'string') return parsed.mode;
    } catch (_) {
      if (typeof msg === 'string') return msg.trim();
    }
  }
  return 'enable';
}

async function getBucketPolicy(bucket) {
  try {
    const res = await s3.send(new GetBucketPolicyCommand({ Bucket: bucket }));
    return JSON.parse(res.Policy);
  } catch (err) {
    if (err && err.name === 'NoSuchBucketPolicy') {
      return { Version: '2012-10-17', Statement: [] };
    }
    throw err;
  }
}

function upsertStatement(policy, statement) {
  const next = Array.isArray(policy.Statement) ? policy.Statement.slice() : [];
  const idx = next.findIndex((s) => s && s.Sid === statement.Sid);
  if (idx === -1) {
    next.push(statement);
    return { changed: true, statement: next };
  }
  return { changed: false, statement: next };
}

function removeStatement(policy, sid) {
  const next = Array.isArray(policy.Statement) ? policy.Statement.slice() : [];
  const filtered = next.filter((s) => !s || s.Sid !== sid);
  return { changed: filtered.length !== next.length, statement: filtered };
}

async function putBucketPolicy(bucket, policy) {
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify(policy),
    })
  );
}

async function deleteBucketPolicy(bucket) {
  await s3.send(new DeleteBucketPolicyCommand({ Bucket: bucket }));
}

async function putFlag(value) {
  await ssm.send(
    new PutParameterCommand({
      Name: SSM_ENABLED_PARAM,
      Type: 'String',
      Value: value,
      Overwrite: true,
    })
  );
}

async function putLastTriggered(value) {
  await ssm.send(
    new PutParameterCommand({
      Name: SSM_LAST_TRIGGERED_PARAM,
      Type: 'String',
      Value: value,
      Overwrite: true,
    })
  );
}

exports.handler = async (event) => {
  if (!TARGET_BUCKET) {
    throw new Error('TARGET_BUCKET is required');
  }

  const mode = parseMode(event);
  const enable = mode !== 'disable';
  const policy = await getBucketPolicy(TARGET_BUCKET);

  let changed = false;
  if (enable) {
    const res = upsertStatement(policy, DENY_STATEMENT(TARGET_BUCKET));
    policy.Statement = res.statement;
    changed = res.changed;
    if (changed) await putBucketPolicy(TARGET_BUCKET, policy);
    await putFlag('true');
    await putLastTriggered(new Date().toISOString());
  } else {
    const res = removeStatement(policy, KILL_SWITCH_SID);
    policy.Statement = res.statement;
    changed = res.changed;
    if (changed) {
      if (policy.Statement.length === 0) {
        await deleteBucketPolicy(TARGET_BUCKET);
      } else {
        await putBucketPolicy(TARGET_BUCKET, policy);
      }
    }
    await putFlag('false');
  }

  return {
    mode: enable ? 'enable' : 'disable',
    changed,
    bucket: TARGET_BUCKET,
  };
};
