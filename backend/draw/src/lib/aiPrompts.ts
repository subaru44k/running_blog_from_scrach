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
      `採点基準を固定する。0-2は成立していない、3-4はかなり弱い、5-6は平均的、7はやや良い、8は明確に良い、9はかなり良い、10はごく少数の例外的に強い作品のみ。` +
      `平均的なユーザー作品に対して安易に7や8を付けないこと。` +
      `rubricは必ず1点刻みの整数で評価すること。` +
      `6項目のうち少なくとも3項目は同じ値にしないこと。` +
      `弱い点が見えたら4以下を使うこと。強みが明確なら9以上を使うこと。` +
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
