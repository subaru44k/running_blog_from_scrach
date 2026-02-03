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

const invokeClaude = async (modelId: string, system: string, userContent: ClaudeContent[], maxTokens: number, temperature: number) => {
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
  return extractText(json);
};

export const invokeClaudeJson = async <T>(modelId: string, system: string, userContent: ClaudeContent[]): Promise<T> => {
  const text = await invokeClaude(modelId, system, userContent, 512, 0.3);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Failed to parse JSON from Bedrock: ${text.slice(0, 200)}`);
  }
};

export const invokeClaudeText = async (modelId: string, system: string, userContent: ClaudeContent[]) => {
  return await invokeClaude(modelId, system, userContent, 512, 0.4);
};
