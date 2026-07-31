import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const loadLocalEnv = (path) => {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
  }
};

loadLocalEnv(resolve(process.cwd(), '.env.local'));

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.DRAW_TABLE || 'DrawSubmissions';
const months = process.argv.slice(2);
if (months.length === 0) throw new Error('Usage: node scripts/snapshot-month-scores.mjs YYYY-MM [YYYY-MM ...]');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const snapshot = { createdAt: new Date().toISOString(), region: REGION, table: TABLE, months: {} };

for (const month of months) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'promptId = :promptId',
      ExpressionAttributeValues: { ':promptId': `prompt-${month}` },
      ExclusiveStartKey,
    }));
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  snapshot.months[month] = items;
  console.log(`${month}: ${items.length} items`);
}

const output = resolve(process.cwd(), `artifacts/score-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
mkdirSync(resolve(process.cwd(), 'artifacts'), { recursive: true });
writeFileSync(output, JSON.stringify(snapshot, null, 2));
console.log(`Saved snapshot: ${output}`);
