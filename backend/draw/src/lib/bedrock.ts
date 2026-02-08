import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({});

const readBody = async (body: any) => {
  if (!body) return '';
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return Buffer.from(body).toString('utf8');
  if (typeof body?.transformToString === 'function') {
    return await body.transformToString();
  }
  if (typeof body?.getReader === 'function') {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  return '';
};

const extractText = (payload: any) => {
  const content = payload?.content;
  if (Array.isArray(content)) {
    const text = content
      .filter((c: any) => c?.type === 'text')
      .map((c: any) => c?.text || '')
      .join('\n');
    return text.trim();
  }
  return '';
};

type ClaudeContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } };

export type BedrockUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type BedrockTextResult = {
  text: string;
  usage: BedrockUsage;
  modelId: string;
};

const toNumber = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const extractUsage = (payload: any): BedrockUsage => {
  const usage = payload?.usage || {};
  const inputTokens = toNumber(usage.input_tokens);
  const outputTokens = toNumber(usage.output_tokens);
  const totalTokens = toNumber(usage.total_tokens || inputTokens + outputTokens);
  return { inputTokens, outputTokens, totalTokens };
};

const invokeClaude = async (modelId: string, system: string, userContent: ClaudeContent[], maxTokens: number, temperature: number): Promise<BedrockTextResult> => {
  const body = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  };
  const res = await client.send(new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(body),
  }));
  const raw = await readBody(res.body);
  const json = raw ? JSON.parse(raw) : {};
  return {
    text: extractText(json),
    usage: extractUsage(json),
    modelId,
  };
};

export type BedrockJsonResult<T> = {
  data: T;
  usage: BedrockUsage;
  modelId: string;
};

export const invokeClaudeJson = async <T>(modelId: string, system: string, userContent: ClaudeContent[]): Promise<BedrockJsonResult<T>> => {
  const result = await invokeClaude(modelId, system, userContent, 512, 0.3);
  try {
    return {
      data: JSON.parse(result.text) as T,
      usage: result.usage,
      modelId: result.modelId,
    };
  } catch {
    throw new Error(`Failed to parse JSON from Bedrock: ${result.text.slice(0, 200)}`);
  }
};

export const invokeClaudeText = async (modelId: string, system: string, userContent: ClaudeContent[]) => {
  return await invokeClaude(modelId, system, userContent, 512, 0.4);
};
