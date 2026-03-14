import { OPENAI_API_KEY_SECRET_ID } from './env';
import { getSecretString } from './secrets';

export type OpenAiUsage = {
  inputTokens: number | null;
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
  const apiKey = await getSecretString(OPENAI_API_KEY_SECRET_ID);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      temperature: 0.2,
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
  const payload = await response.json();
  const text = getOutputText(payload);
  return {
    data: parseJsonText<T>(text),
    modelId: payload?.model || modelId,
    usage: {
      inputTokens: payload?.usage?.input_tokens ?? null,
      outputTokens: payload?.usage?.output_tokens ?? null,
      totalTokens: payload?.usage?.total_tokens ?? null,
    },
  };
};
