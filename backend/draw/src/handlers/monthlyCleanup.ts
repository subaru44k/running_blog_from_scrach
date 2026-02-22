import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
  type ObjectIdentifier,
} from '@aws-sdk/client-s3';
import { ddb } from '../lib/ddb';

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env ${key}`);
  return value;
};

const DRAW_BUCKET = requireEnv('DRAW_BUCKET');
const DRAW_TABLE = requireEnv('DRAW_TABLE');
const KEEP_LIMIT = Number(process.env.LEADERBOARD_KEEP_LIMIT || 20);

const s3 = new S3Client({});

const pad2 = (v: number) => String(v).padStart(2, '0');

const jstNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));

const normalizeMonth = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(5, 7));
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) return null;
  return `${year}-${pad2(month)}`;
};

const resolveTargetMonth = (input?: string | null) => {
  const explicit = normalizeMonth(input);
  if (explicit) return explicit;
  const now = jstNow();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}`;
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

export const handler = async (event: any = {}) => {
  const targetMonth = resolveTargetMonth(event?.month);
  const promptId = `prompt-${targetMonth}`;
  const prefix = `draw/${promptId}/`;

  const top = await ddb.send(new QueryCommand({
    TableName: DRAW_TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': promptId },
    ProjectionExpression: 'imageKey, submissionId, score',
    ScanIndexForward: true,
    Limit: KEEP_LIMIT,
  }));

  const keepKeys = new Set<string>();
  for (const item of top.Items || []) {
    if (typeof item.imageKey === 'string') keepKeys.add(item.imageKey);
  }

  const allKeys: string[] = [];
  let continuationToken: string | undefined = undefined;
  do {
    const listed: any = await s3.send(new ListObjectsV2Command({
      Bucket: DRAW_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const obj of listed.Contents || []) {
      if (!obj.Key) continue;
      allKeys.push(obj.Key);
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  const toDelete = allKeys
    .filter((key) => key.startsWith(prefix))
    .filter((key) => !keepKeys.has(key))
    .map((key) => ({ Key: key }));

  let deleted = 0;
  for (const batch of chunk<ObjectIdentifier>(toDelete, 1000)) {
    if (!batch.length) continue;
    const res = await s3.send(new DeleteObjectsCommand({
      Bucket: DRAW_BUCKET,
      Delete: { Objects: batch, Quiet: true },
    }));
    deleted += res.Deleted?.length || 0;
  }

  const summary = {
    targetMonth,
    promptId,
    prefix,
    scanned: allKeys.length,
    keepCount: keepKeys.size,
    deleteCandidates: toDelete.length,
    deleted,
    kept: allKeys.length - deleted,
  };

  console.log('draw_monthly_cleanup_summary', JSON.stringify(summary));
  return summary;
};
