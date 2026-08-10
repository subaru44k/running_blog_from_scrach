import { OPENAI_API_KEY_SECRET_ID, OPENAI_REASONING_EFFORT } from './env.js';
import { getSecretString } from './secrets.js';

export type OpenAiUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type OpenAiJsonResult<T> = {
  data: T;
  modelId: string;
  usage: OpenAiUsage;
};

type OpenAiInputPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string };

const getOutputText = (payload: any) => {
  const chunks: string[] = [];
  for (const block of payload?.output || []) {
    for (const content of block?.content || []) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') {
        chunks.push(content.text);
      }
    }
  }
  if (chunks.length > 0) return chunks.join('\n').trim();
  if (typeof payload?.output_text === 'string') return payload.output_text.trim();
  return '';
};

const parseJsonText = <T>(text: string): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) return JSON.parse(fenced) as T;
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(text.slice(first, last + 1)) as T;
    }
    throw new Error('OpenAI JSON parse failed');
  }
};

export const invokeOpenAIJson = async <T>(
  modelId: string,
  system: string,
  inputParts: OpenAiInputPart[],
): Promise<OpenAiJsonResult<T>> => {
  const supportedEfforts = modelId === 'gpt-5.6-luna'
    ? ['none', 'low', 'medium', 'high', 'xhigh', 'max']
    : ['minimal', 'low', 'medium', 'high'];
  if (!supportedEfforts.includes(OPENAI_REASONING_EFFORT)) {
    throw new Error(`Unsupported reasoning effort ${OPENAI_REASONING_EFFORT} for ${modelId}`);
  }
  const apiKey = await getSecretString(OPENAI_API_KEY_SECRET_ID);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      reasoning: { effort: OPENAI_REASONING_EFFORT },
      text: {
        format: {
          type: 'json_schema',
          name: 'draw_primary_review',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['rubric', 'review', 'tips'],
            properties: {
              rubric: {
                type: 'object',
                additionalProperties: false,
                required: ['promptMatch', 'composition', 'shapeClarity', 'lineStability', 'creativity', 'completeness'],
                properties: Object.fromEntries(['promptMatch', 'composition', 'shapeClarity', 'lineStability', 'creativity', 'completeness'].map((key) => [key, { type: 'integer', minimum: 0, maximum: 10 }])),
              },
              review: {
                type: 'object',
                additionalProperties: false,
                required: ['summary', 'goodPoint', 'improvement', 'nextStep'],
                properties: Object.fromEntries(['summary', 'goodPoint', 'improvement', 'nextStep'].map((key) => [key, { type: 'string' }])),
              },
              tips: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
            },
          },
        },
      },
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: system }],
        },
        {
          role: 'user',
          content: inputParts,
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  }
  const payload: any = await response.json();
  const text = getOutputText(payload);
  return {
    data: parseJsonText<T>(text),
    modelId: payload?.model || modelId,
    usage: {
      inputTokens: payload?.usage?.input_tokens ?? null,
      cachedInputTokens: payload?.usage?.input_tokens_details?.cached_tokens ?? null,
      cacheWriteTokens: payload?.usage?.input_tokens_details?.cache_write_tokens ?? null,
      outputTokens: payload?.usage?.output_tokens ?? null,
      totalTokens: payload?.usage?.total_tokens ?? null,
    },
  };
};
