import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../lib/ddb';
import { DRAW_TABLE } from '../lib/env';
import { json, options } from '../lib/http';
import type { SecondaryReviewResult } from '../types';

export const handler = async (event: any) => {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  if (event?.requestContext?.http?.method === 'OPTIONS') return options(origin);
  try {
    const submissionId = event?.queryStringParameters?.submissionId;
    if (!submissionId) return json(400, { status: 'not_found' }, origin);

    const scan = await ddb.send(new ScanCommand({
      TableName: DRAW_TABLE,
      FilterExpression: 'submissionId = :sid',
      ExpressionAttributeValues: { ':sid': submissionId },
      Limit: 1,
      ProjectionExpression: 'submissionId, secondaryStatus, enrichedComment',
    }));

    const item = scan.Items?.[0] as any | undefined;
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
