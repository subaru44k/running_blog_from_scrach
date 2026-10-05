import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from './ddb.js';
import { DRAW_TABLE } from './env.js';

/**
 * Return the 1-based position of a score key in the live leaderboard.
 * The GSI sort key contains the score, creation time, and submission ID, so
 * counting keys before it reproduces the exact order returned by leaderboard.
 */
export const getCurrentRank = async (promptId: string, scoreSortKey?: string) => {
  if (!promptId || !scoreSortKey) return undefined;

  let count = 0;
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const response = await ddb.send(new QueryCommand({
      TableName: DRAW_TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :promptId AND scoreSortKey < :scoreSortKey',
      ExpressionAttributeValues: {
        ':promptId': promptId,
        ':scoreSortKey': scoreSortKey,
      },
      Select: 'COUNT',
      ExclusiveStartKey,
    }));
    count += response.Count || 0;
    ExclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  return count + 1;
};
