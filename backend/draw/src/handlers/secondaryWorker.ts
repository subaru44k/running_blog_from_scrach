import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../lib/ddb';
import { DRAW_BUCKET, DRAW_TABLE, SECONDARY_MODEL_ID } from '../lib/env';
import { getObjectBuffer } from '../lib/s3';
import { invokeClaudeText } from '../lib/bedrock';
import { buildSecondaryUser, secondarySystemPrompt } from '../lib/aiPrompts';

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

      let enrichedComment = enrichStub(score ?? item.score ?? 0);
      try {
        const imageKey = String(item.imageKey || '');
        const promptText = String(item.promptText || 'お題不明');
        const imageBuffer = await getObjectBuffer(DRAW_BUCKET, imageKey);
        const imageBase64 = imageBuffer.toString('base64');
        enrichedComment = await invokeClaudeText(
          SECONDARY_MODEL_ID,
          secondarySystemPrompt,
          buildSecondaryUser({
            promptText,
            imageBase64,
            score: Number(item.score || score || 0),
            breakdown: item.breakdown || { likeness: 0, composition: 0, originality: 0 },
            oneLiner: item.oneLiner || '',
            tips: Array.isArray(item.tips) ? item.tips : [],
          }),
        );
      } catch (err) {
        console.error('secondary_bedrock_failed', err);
        // keep existing behavior: failed after second attempt; first failure keeps pending
        await ddb.send(new UpdateCommand({
          TableName: DRAW_TABLE,
          Key: { promptId, submissionId },
          UpdateExpression: 'SET secondaryAttempts = :attempts',
          ExpressionAttributeValues: { ':attempts': attempts + 1 },
        }));
        continue;
      }

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
