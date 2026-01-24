import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from './ddb';
import { RATE_LIMIT_TABLE, RATE_LIMIT_WINDOW_SECONDS } from './env';

export const rateLimit = async (key: string, limit: number) => {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_SECONDS) * RATE_LIMIT_WINDOW_SECONDS;
  const ttl = windowStart + RATE_LIMIT_WINDOW_SECONDS + 60;
  const pk = `${key}#${windowStart}`;
  const result = await ddb.send(new UpdateCommand({
    TableName: RATE_LIMIT_TABLE,
    Key: { key: pk },
    UpdateExpression: 'ADD #count :inc SET expiresAt = :ttl',
    ExpressionAttributeNames: { '#count': 'count' },
    ExpressionAttributeValues: { ':inc': 1, ':ttl': ttl },
    ReturnValues: 'UPDATED_NEW',
  }));
  const count = Number(result.Attributes?.count || 0);
  if (count > limit) {
    const error = new Error('Rate limit exceeded');
    (error as any).statusCode = 429;
    throw error;
  }
  return count;
};
