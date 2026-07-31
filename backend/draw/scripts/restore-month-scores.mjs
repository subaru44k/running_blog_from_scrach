import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) throw new Error('Usage: node scripts/restore-month-scores.mjs artifacts/score-snapshot-*.json');
const snapshot = JSON.parse(readFileSync(path, 'utf8'));
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: snapshot.region || process.env.AWS_REGION || 'ap-northeast-1' }));

let restored = 0;
for (const [month, items] of Object.entries(snapshot.months || {})) {
  for (const item of items) {
    await ddb.send(new PutCommand({ TableName: snapshot.table || process.env.DRAW_TABLE || 'DrawSubmissions', Item: item }));
    restored += 1;
  }
  console.log(`${month}: restored ${items.length} items`);
}
console.log(`Restored items: ${restored}`);
