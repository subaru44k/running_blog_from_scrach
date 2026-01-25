import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../lib/ddb';
import { DRAW_TABLE } from '../lib/env';
import { json, options } from '../lib/http';
import type { SecondaryReviewResult } from '../types';

export const handler = async (event: any) => {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  if (event?.requestContext?.http?.method === 'OPTIONS') return options(origin);
  try {
    const promptId = event?.queryStringParameters?.promptId;
    const submissionId = event?.queryStringParameters?.submissionId;
    if (!promptId || !submissionId) return json(400, { status: 'not_found' }, origin);

    const query = await ddb.send(new QueryCommand({
      TableName: DRAW_TABLE,
      KeyConditionExpression: 'promptId = :pk AND submissionId = :sk',
      ExpressionAttributeValues: { ':pk': promptId, ':sk': submissionId },
      ProjectionExpression: 'submissionId, secondaryStatus, enrichedComment',
    }));

    const item = query.Items?.[0] as any | undefined;
    if (!item) return json(404, { status: 'not_found' }, origin);

    if (item.secondaryStatus === 'pending') {
      return json(202, { status: 'pending' }, origin);
    }
    if (item.secondaryStatus === 'done' && item.enrichedComment) {
      const body: SecondaryReviewResult = {
        submissionId: item.submissionId,
        enrichedComment: item.enrichedComment,
      };
      return json(200, body, origin);
    }

    return json(404, { status: 'not_found' }, origin);
  } catch (err: any) {
    return json(500, { status: 'not_found', error: err?.message || 'failed' }, origin);
  }
};
