export const primarySystemPrompt = `あなたは30秒お絵描きゲームの一次採点担当です。
返答は必ず日本語で作成してください。
英語・ローマ字・英単語は一切使わないでください。
必ずJSONのみで返してください。説明文や前置きは不要です。`;

export const secondarySystemPrompt = `あなたは30秒お絵描きゲームの二次講評担当です。
丁寧で前向きな日本語で、短く実用的な講評を返してください。`;

export const buildPrimaryUser = (promptText: string, imageBase64: string) => ([
  {
    type: 'text',
    text: `お題: ${promptText || 'お題不明'}\n画像を評価して、次のJSONスキーマで返してください。\n` +
      `{"rubric":{"promptMatch":0-10,"composition":0-10,"shapeClarity":0-10,"lineStability":0-10,"creativity":0-10,"completeness":0-10},` +
      `"oneLiner":"90文字以内の前向き短評","tips":["短い名詞句を2-3個"]}\n` +
      `注意: 数値は整数。rubricの各項目は0〜10。` +
      `rubricは1点刻みで評価すること。` +
      `5点刻み（例: 70/75/80）への偏りを避けること。` +
      `5や10の多用を避け、必要時のみ例外的に使用すること。` +
      `同点を減らすため、画像ごとの差分を反映し、近い評価帯でも1〜3点の差を積極的に付けること。` +
      `rubricの6項目のうち、少なくとも2項目は他作品との差が出るように評価すること。` +
      `曖昧な場合は6/7/8/9を優先すること。` +
      `oneLinerとtipsは日本語のみで出力し、英語表現は使わないこと。` +
      `tipsは体言止めの短い語句にすること。`,
  },
  {
    type: 'image',
    source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
  },
]);

export const buildSecondaryUser = (params: {
  promptText: string;
  imageBase64: string;
  score: number;
  breakdown: { likeness: number; composition: number; originality: number };
  oneLiner: string;
  tips: string[];
}) => ([
  {
    type: 'text',
    text: `お題: ${params.promptText || 'お題不明'}\n` +
      `一次結果: score=${params.score}, breakdown=${JSON.stringify(params.breakdown)}, oneLiner=${params.oneLiner}, tips=${params.tips.join(',')}\n` +
      `日本語で2〜4文、220文字以内。\n` +
      `1文目: 良い点を1つ。2〜3文目: 具体的改善点を1〜2個。最後: 前向きに締める。`,
  },
  {
    type: 'image',
    source: { type: 'base64', media_type: 'image/png', data: params.imageBase64 },
  },
]);
