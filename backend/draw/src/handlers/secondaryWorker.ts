import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../lib/ddb';
import { DRAW_TABLE } from '../lib/env';

const enrichStub = (score: number) => {
  if (score >= 90) return '輪郭の勢いがあり、見る流れが自然です。余白の使い方を少し揃えるとさらに締まります。';
  if (score >= 80) return '形のバランスが良く、雰囲気が伝わります。中心の軸を意識すると安定します。';
  if (score >= 70) return '素直に形を捉えられています。線の強弱を意識すると見やすくなります。';
  return '線のリズムが心地よいです。外形から取るとまとまりやすくなります。';
};

export const handler = async (event: any) => {
  const records = event?.Records || [];
  for (const record of records) {
    try {
      const body = JSON.parse(record.body || '{}');
      const { promptId, submissionId, score } = body;
      if (!promptId || !submissionId) continue;
      const existing = await ddb.send(new GetCommand({
        TableName: DRAW_TABLE,
        Key: { promptId, submissionId },
      }));
      const item = existing.Item as any;
      if (!item) continue;
      const attempts = Number(item.secondaryAttempts || 0);
      if (item.secondaryStatus === 'done' || item.secondaryStatus === 'failed') continue;
      if (attempts >= 1) {
        await ddb.send(new UpdateCommand({
          TableName: DRAW_TABLE,
          Key: { promptId, submissionId },
          UpdateExpression: 'SET secondaryStatus = :failed, secondaryAttempts = :attempts',
          ExpressionAttributeValues: { ':failed': 'failed', ':attempts': attempts + 1 },
        }));
        continue;
      }

      const enrichedComment = enrichStub(score ?? item.score ?? 0);
      await ddb.send(new UpdateCommand({
        TableName: DRAW_TABLE,
        Key: { promptId, submissionId },
        UpdateExpression: 'SET secondaryStatus = :done, enrichedComment = :comment, secondaryAttempts = :attempts',
        ExpressionAttributeValues: {
          ':done': 'done',
          ':comment': enrichedComment,
          ':attempts': attempts + 1,
        },
      }));
    } catch {
      // best-effort; SQS retry handles failures
    }
  }
  return { statusCode: 200 };
};
