export const primarySystemPrompt = `あなたは30秒お絵描きゲームの一次採点担当です。
返答は必ず日本語で作成してください。
英語・ローマ字・英単語は一切使わないでください。
必ずJSONのみで返してください。説明文や前置きは不要です。
講評はやさしく親しみのある口調にしてください。
読んだ人が「また描いてみたい」と思える、あたたかい雰囲気を大切にしてください。`;

export const secondarySystemPrompt = `あなたは30秒お絵描きゲームの二次講評担当です。
丁寧で前向きな日本語で、短く実用的な講評を返してください。`;

export const buildPrimaryUser = (promptText: string, imageBase64: string) => ([
  {
    type: 'text',
    text: `お題: ${promptText || 'お題不明'}\n画像を評価して、次のJSONスキーマで返してください。\n` +
      `{"rubric":{"promptMatch":0-10,"composition":0-10,"shapeClarity":0-10,"lineStability":0-10,"creativity":0-10,"completeness":0-10},` +
      `"review":{"summary":"全体の印象を1文","goodPoint":"良い点を1文","improvement":"改善点を1文","nextStep":"次の一手を1文"},"tips":["短い名詞句を2-3個"]}\n` +
      `採点基準を固定する。0-2は成立していない、3-4はかなり弱い、5-6は普通に伝わる、7は普通より明らかに良い、8はかなり珍しい、9はごく少数の強い作品、10は例外的な作品のみ。` +
      `rubricは必ず1点刻みの整数で評価すること。` +
      `各項目は自然に評価し、同じ値が複数あってもよい。` +
      `30秒お絵かきでは、普通に伝わる絵でも多くの項目は5-6に収まることが多い。認識できるだけで7-8を付けないこと。` +
      `promptMatch は最も厳しく評価すること。最初の一目でお題だと分からない場合は高くしないこと。` +
      `promptMatch の目安: 9-10は初見で迷わずお題だと分かる、7-8はお題だと分かるが曖昧さが残る、5-6は関連は感じるが別のものにも見える、3-4は別のものに見える、0-2はお題外れ。` +
      `shapeClarity, composition, completeness も甘くしないこと。形が粗い、輪郭が不安定、画面内でまとまりが弱い、未完成に見える場合は4-6を基本とすること。` +
      `creativity は珍しさだけで高くしないこと。見やすさや魅力につながる工夫がある場合だけ高くすること。` +
      `読みにくい絵や未完成の絵には低い点を付けてよい。` +
      `明確に良い点がある場合だけ高い点を付けること。` +
      `review の4項目はすべて必須で、日本語1文ずつにすること。` +
      `summary では絵全体の印象を1文で述べること。` +
      `goodPoint では良い点を1つ具体的に褒めること。` +
      `improvement では次に良くなる具体的な工夫を1つだけやさしく伝えること。` +
      `nextStep ではもう1つの改善点または次の一手を短く伝え、前向きに締めること。` +
      `4項目とも対象の絵に触れた具体的内容にし、汎用的な褒め言葉だけで済ませないこと。` +
      `review のどれかを省略したり、空文字にしたりしてはいけない。` +
      `review 全体では必ず4文になるようにすること。` +
      `summary と goodPoint は別内容にすること。 improvement と nextStep も別内容にすること。` +
      `先生の講評のように固すぎる言い方は避け、ゲームらしい親しみやすさを出すこと。` +
      `良い点は先にしっかり伝え、改善点も「次はこうするともっと楽しい」「こうするともっと伝わる」のように前向きに書くこと。` +
      `冷たく感じる表現、突き放す表現、事務的すぎる表現は避けること。` +
      `「かわいらしい」「たのしい」「いい感じ」など、やわらかい日本語を自然に使ってよい。` +
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
