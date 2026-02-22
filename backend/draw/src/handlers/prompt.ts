import { json, options } from '../lib/http';
import { resolveDrawPrompt } from '../lib/prompt';

export const handler = async (event: any) => {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  if (event?.requestContext?.http?.method === 'OPTIONS') return options(origin);
  try {
    const month = event?.queryStringParameters?.month;
    const prompt = resolveDrawPrompt({ month });
    return json(200, {
      promptId: prompt.promptId,
      dateJst: prompt.dateJst,
      promptText: prompt.promptText,
    }, origin);
  } catch (err: any) {
    return json(500, { error: err?.message || 'failed' }, origin);
  }
};

