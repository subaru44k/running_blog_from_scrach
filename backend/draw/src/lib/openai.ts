import { OPENAI_API_KEY_SECRET_ID, OPENAI_REASONING_EFFORT } from './env.js';
import { getSecretString } from './secrets.js';
import { rubricKeys } from './gameScore.js';

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
  schema?: Record<string, any>,
): Promise<OpenAiJsonResult<T>> => {
  const supportedEfforts = ['gpt-5.6-luna', 'gpt-6-luna'].includes(modelId)
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
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      model: modelId,
      reasoning: { effort: OPENAI_REASONING_EFFORT },
      text: {
        format: {
          type: 'json_schema',
          name: 'draw_primary_review',
          strict: true,
          schema: schema || {
            type: 'object',
            additionalProperties: false,
            required: ['rubric', 'axis_evidence', 'review', 'tips', 'childReview', 'childTips'],
            properties: {
              rubric: {
                type: 'object',
                additionalProperties: false,
                required: [...rubricKeys],
                properties: Object.fromEntries(rubricKeys.map(key => [key, { type: 'integer', minimum: 0, maximum: 6 }])),
              },
              axis_evidence: {
                type: 'object', additionalProperties: false, required: [...rubricKeys],
                properties: Object.fromEntries(rubricKeys.map(key => [key, {type: 'array', items: {type: 'string', minLength: 1, maxLength: 120}, minItems: 1, maxItems: 2}])),
              },
              review: {
                type: 'object',
                additionalProperties: false,
                required: ['summary', 'goodPoint', 'improvement', 'nextStep'],
                properties: Object.fromEntries(['summary', 'goodPoint', 'improvement', 'nextStep'].map((key) => [key, { type: 'string' }])),
              },
              tips: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
              childReview: {
                type: 'object',
                additionalProperties: false,
                required: ['summary', 'goodPoint', 'improvement', 'nextStep'],
                properties: Object.fromEntries(['summary', 'goodPoint', 'improvement', 'nextStep'].map((key) => [key, { type: 'string' }])),
              },
              childTips: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
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
    throw new Error(`OpenAI HTTP ${response.status}`);
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
