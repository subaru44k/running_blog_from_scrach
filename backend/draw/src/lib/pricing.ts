const MODEL_PRICING_USD_PER_MILLION: Record<string, { input: number; cachedInput: number; cacheWrite: number; output: number }> = {
  'gpt-4.1-mini': { input: 0.4, cachedInput: 0.1, cacheWrite: 0.5, output: 1.6 },
  'gpt-5-mini': { input: 0.25, cachedInput: 0.025, cacheWrite: 0.3125, output: 2.0 },
  'gpt-5-nano': { input: 0.05, cachedInput: 0.005, cacheWrite: 0.0625, output: 0.4 },
  'gpt-5.4-nano': { input: 0.2, cachedInput: 0.02, cacheWrite: 0.25, output: 1.25 },
  'gpt-6-luna': { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5 },
  'gpt-5.6-luna': { input: 0.2, cachedInput: 0.02, cacheWrite: 0.25, output: 1.2 },
};

export type OpenAiUsageForPricing = {
  inputTokens: number | null;
  cachedInputTokens?: number | null;
  cacheWriteTokens?: number | null;
  outputTokens: number | null;
};

export const estimateOpenAiUsd = (usage: OpenAiUsageForPricing, modelId = 'gpt-4.1-mini') => {
  const pricing = MODEL_PRICING_USD_PER_MILLION[modelId] || MODEL_PRICING_USD_PER_MILLION['gpt-4.1-mini'];
  const input = Math.max(0, usage.inputTokens || 0);
  const cachedInput = Math.min(input, Math.max(0, usage.cachedInputTokens || 0));
  const cacheWrite = Math.min(input - cachedInput, Math.max(0, usage.cacheWriteTokens || 0));
  const uncachedInput = Math.max(0, input - cachedInput - cacheWrite);
  const output = Math.max(0, usage.outputTokens || 0);
  return Number(
    (
      (uncachedInput / 1_000_000) * pricing.input +
      (cachedInput / 1_000_000) * pricing.cachedInput +
      (cacheWrite / 1_000_000) * pricing.cacheWrite +
      (output / 1_000_000) * pricing.output
    ).toFixed(8),
  );
};
