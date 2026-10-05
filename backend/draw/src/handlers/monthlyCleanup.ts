import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
  type ObjectIdentifier,
} from '@aws-sdk/client-s3';
import { ddb } from '../lib/ddb.js';

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env ${key}`);
  return value;
};

const DRAW_BUCKET = requireEnv('DRAW_BUCKET');
const DRAW_TABLE = requireEnv('DRAW_TABLE');
const KEEP_LIMIT = Number(process.env.LEADERBOARD_KEEP_LIMIT || 20);
const ARCHIVE_TTL_DAYS = Number(process.env.ARCHIVE_TTL_DAYS || 3650);
const PRACTICE_IMAGE_RETENTION_DAYS = Number(process.env.PRACTICE_IMAGE_RETENTION_DAYS || 7);
const PRACTICE_PREFIX = 'draw/practice/';

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

const resolveTargetMonth = (explicitMonth?: string | null) => {
  if (explicitMonth) return explicitMonth;
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

type ListedObject = {
  key: string;
  lastModified?: Date;
};

const listObjects = async (prefix: string): Promise<ListedObject[]> => {
  const objects: ListedObject[] = [];
  let continuationToken: string | undefined;
  do {
    const listed = await s3.send(new ListObjectsV2Command({
      Bucket: DRAW_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const object of listed.Contents || []) {
      if (!object.Key) continue;
      objects.push({ key: object.Key, lastModified: object.LastModified });
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
};

const deleteObjects = async (keys: string[]) => {
  let deleted = 0;
  for (const batch of chunk<ObjectIdentifier>(keys.map((Key) => ({ Key })), 1000)) {
    if (!batch.length) continue;
    const response = await s3.send(new DeleteObjectsCommand({
      Bucket: DRAW_BUCKET,
      Delete: { Objects: batch, Quiet: true },
    }));
    deleted += batch.length - (response.Errors?.length || 0);
  }
  return deleted;
};

const cleanupPracticeImages = async () => {
  const practiceObjects = await listObjects(PRACTICE_PREFIX);
  const practiceCutoff = Date.now() - PRACTICE_IMAGE_RETENTION_DAYS * 86400 * 1000;
  const practiceToDelete = practiceObjects
    .filter((object) => object.key.startsWith(PRACTICE_PREFIX))
    .filter((object) => object.lastModified && object.lastModified.getTime() < practiceCutoff)
    .map((object) => object.key);
  const practiceDeleted = await deleteObjects(practiceToDelete);
  return {
    practiceScanned: practiceObjects.length,
    practiceDeleteCandidates: practiceToDelete.length,
    practiceDeleted,
  };
};

const skippedSummary = (jstDate: Date) => ({
  skipped: true,
  reason: 'not_jst_first_day',
  jstDate: `${jstDate.getFullYear()}-${pad2(jstDate.getMonth() + 1)}-${pad2(jstDate.getDate())}`,
});

export const handler = async (event: any = {}) => {
  const requestedMonth = String(event?.month || '').trim();
  const explicitMonth = normalizeMonth(requestedMonth);
  if (requestedMonth && !explicitMonth) {
    throw new Error('month must be YYYY-MM');
  }

  const nowJst = jstNow();
  if (!explicitMonth && nowJst.getDate() !== 1) {
    const summary = {
      ...skippedSummary(nowJst),
      ...(await cleanupPracticeImages()),
    };
    console.log('draw_monthly_cleanup_summary', JSON.stringify(summary));
    return summary;
  }

  const targetMonth = resolveTargetMonth(explicitMonth);
  const promptId = `prompt-${targetMonth}`;
  const prefix = `draw/${promptId}/`;
  const finalizedAt = new Date().toISOString();

  const top = await ddb.send(new QueryCommand({
    TableName: DRAW_TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :promptId',
    ExpressionAttributeValues: { ':promptId': promptId },
    ProjectionExpression: 'submissionId, imageKey, scoreSortKey',
    ScanIndexForward: true,
    Limit: KEEP_LIMIT,
  }));

  const topSubmissionIds = new Set<string>();
  const keepKeys = new Set<string>();
  const archiveExpiresAt = Math.floor(Date.now() / 1000) + ARCHIVE_TTL_DAYS * 86400;
  for (const [idx, item] of (top.Items || []).entries()) {
    if (typeof item.submissionId !== 'string') continue;
    topSubmissionIds.add(item.submissionId);
    if (typeof item.imageKey === 'string') keepKeys.add(item.imageKey);
    await ddb.send(new UpdateCommand({
      TableName: DRAW_TABLE,
      Key: { promptId, submissionId: item.submissionId },
      UpdateExpression: 'SET expiresAt = :expiresAt, isRanked = :isRanked, #rank = :rank, rankingEligible = :rankingEligible, rankingStatus = :rankingStatus, rankingFinalizedAt = :rankingFinalizedAt',
      ExpressionAttributeNames: { '#rank': 'rank' },
      ExpressionAttributeValues: {
        ':expiresAt': archiveExpiresAt,
        ':isRanked': true,
        ':rank': idx + 1,
        ':rankingEligible': true,
        ':rankingStatus': 'final_top20',
        ':rankingFinalizedAt': finalizedAt,
      },
    }));
  }

  const submissions: Array<{ submissionId: string; imageKey?: string; rankingEligible?: boolean }> = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  do {
    const response = await ddb.send(new QueryCommand({
      TableName: DRAW_TABLE,
      KeyConditionExpression: 'promptId = :promptId',
      ExpressionAttributeValues: { ':promptId': promptId },
      ProjectionExpression: 'submissionId, imageKey, rankingEligible',
      ExclusiveStartKey: lastEvaluatedKey,
    }));
    for (const item of response.Items || []) {
      if (typeof item.submissionId === 'string') {
        submissions.push({
          submissionId: item.submissionId,
          imageKey: typeof item.imageKey === 'string' ? item.imageKey : undefined,
          rankingEligible: item.rankingEligible,
        });
      }
    }
    lastEvaluatedKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  let finalizedOutsideTop20 = 0;
  for (const item of submissions) {
    if (topSubmissionIds.has(item.submissionId)) continue;
    const isPractice = item.rankingEligible === false || item.imageKey?.startsWith(PRACTICE_PREFIX);
    if (isPractice) continue;
    await ddb.send(new UpdateCommand({
      TableName: DRAW_TABLE,
      Key: { promptId, submissionId: item.submissionId },
      UpdateExpression: 'SET isRanked = :isRanked, rankingStatus = :rankingStatus, rankingFinalizedAt = :rankingFinalizedAt REMOVE #gsiPk, #scoreSortKey, #legacyGsiSk, #rank',
      ExpressionAttributeNames: {
        '#gsiPk': 'GSI1PK',
        '#scoreSortKey': 'scoreSortKey',
        '#legacyGsiSk': 'GSI1SK',
        '#rank': 'rank',
      },
      ExpressionAttributeValues: {
        ':isRanked': false,
        ':rankingStatus': 'final_outside_top20',
        ':rankingFinalizedAt': finalizedAt,
      },
    }));
    finalizedOutsideTop20 += 1;
  }

  const normalObjects = await listObjects(prefix);
  const toDelete = normalObjects
    .filter((object) => object.key.startsWith(prefix))
    .filter((object) => !keepKeys.has(object.key))
    .map((object) => object.key);
  const deleted = await deleteObjects(toDelete);

  const practiceSummary = await cleanupPracticeImages();

  const summary = {
    skipped: false,
    targetMonth,
    promptId,
    prefix,
    submissionScanned: submissions.length,
    finalizedTop20: topSubmissionIds.size,
    finalizedOutsideTop20,
    scanned: normalObjects.length,
    keepCount: keepKeys.size,
    archiveExpiresAt,
    deleteCandidates: toDelete.length,
    deleted,
    kept: normalObjects.length - deleted,
    ...practiceSummary,
  };

  console.log('draw_monthly_cleanup_summary', JSON.stringify(summary));
  return summary;
};
