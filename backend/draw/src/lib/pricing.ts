const MODEL_PRICING_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-5-mini': { input: 0.25, output: 2.0 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
};

export const estimateOpenAiUsd = (inputTokens: number | null, outputTokens: number | null, modelId = 'gpt-4.1-mini') => {
  const pricing = MODEL_PRICING_USD_PER_MILLION[modelId] || MODEL_PRICING_USD_PER_MILLION['gpt-4.1-mini'];
  const input = Math.max(0, inputTokens || 0);
  const output = Math.max(0, outputTokens || 0);
  return Number(
    (
      (input / 1_000_000) * pricing.input +
      (output / 1_000_000) * pricing.output
    ).toFixed(8),
  );
};
