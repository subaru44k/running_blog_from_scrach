const OPENAI_GPT41MINI_INPUT_PER_MILLION = 0.4;
const OPENAI_GPT41MINI_OUTPUT_PER_MILLION = 1.6;

export const estimateOpenAiUsd = (inputTokens: number | null, outputTokens: number | null) => {
  const input = Math.max(0, inputTokens || 0);
  const output = Math.max(0, outputTokens || 0);
  return Number(
    (
      (input / 1_000_000) * OPENAI_GPT41MINI_INPUT_PER_MILLION +
      (output / 1_000_000) * OPENAI_GPT41MINI_OUTPUT_PER_MILLION
    ).toFixed(8),
  );
};
