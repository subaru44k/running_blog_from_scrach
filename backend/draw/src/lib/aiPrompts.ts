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
      `"oneLiner":"日本語2-4文、220文字以内の講評","tips":["短い名詞句を2-3個"]}\n` +
      `採点基準を固定する。0-2は成立していない、3-4はかなり弱い、5-6は平均的、7はやや良い、8は明確に良い、9はかなり良い、10はごく少数の例外的に強い作品のみ。` +
      `rubricは必ず1点刻みの整数で評価すること。` +
      `各項目は自然に評価し、同じ値が複数あってもよい。` +
      `お題と違うものを描いている場合は promptMatch を低くしてよい。` +
      `読みにくい絵や未完成の絵には低い点を付けてよい。` +
      `明確に良い点がある場合だけ高い点を付けること。` +
      `oneLinerは日本語のみで、2〜4文、220文字以内にすること。` +
      `1文目では良い点を1つ具体的に褒めること。` +
      `2〜3文目では、次に良くなる具体的な工夫を1〜2個だけやさしく伝えること。` +
      `最後は前向きなひとことで締めること。` +
      `人格否定や断定的な否定語は使わないこと。` +
      `tipsは日本語のみで出力し、英語表現は使わないこと。` +
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
