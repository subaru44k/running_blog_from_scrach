import adoptedPrompt from '../../../../tools/draw-evaluation/prompt-v3.md';
import adoptedRubric from '../../../../tools/draw-evaluation/rubric-v2.json' with { type: 'json' };
import type { ClaudeContent } from '../types.js';

export const primarySystemPrompt = `あなたは30秒お絵描きゲームの一次採点担当です。
返答は必ず日本語で作成してください。
英語・ローマ字・英単語は一切使わないでください。
必ずJSONのみで返してください。説明文や前置きは不要です。
講評はやさしく親しみのある口調にしてください。
読んだ人が「また描いてみたい」と思える、あたたかい雰囲気を大切にしてください。`;

export const secondarySystemPrompt = `あなたは30秒お絵描きゲームの二次講評担当です。
丁寧で前向きな日本語で、短く実用的な講評を返してください。`;

export const buildPrimaryUser = (promptText: string, imageBase64: string): ClaudeContent[] => ([
  {
    type: 'text',
    text: `お題: ${promptText || 'お題不明'}\n画像を評価して、次のJSONスキーマで返してください。\n` +
      `{"rubric":{"subject_match":0-6,"feature_capture":0-6,"form_coherence":0-6,"finish_quality":0-6},"axis_evidence":{"subject_match":["根拠"],"feature_capture":["根拠"],"form_coherence":["根拠"],"finish_quality":["根拠"]},` +
      `"review":{"summary":"全体の印象を1文","goodPoint":"良い点を1文","improvement":"改善点を1文","nextStep":"次の一手を1文"},"tips":["短い名詞句を2-3個"],` +
      `"childReview":{"summary":"4歳向けの全体の印象を1文","goodPoint":"4歳向けの良い点を1文","improvement":"4歳向けの工夫を1文","nextStep":"4歳向けの次の一手を1文"},"childTips":["4歳向けの短い語句を2-3個"]}\n` +
      adoptedPrompt.split('visual_observations / positive_points / improvement_points')[0] +
      `\n段階定義: ${JSON.stringify(adoptedRubric)}\n` +
      `rubricは4軸、axis_evidenceは各軸1〜2件の可視的な根拠。総合点は出力しない。\n` +
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
      `tipsは体言止めの短い語句にすること。` +
      `childReviewはreviewと同じ絵の内容を、4歳の子どもが自分で読めることばに言い換えること。` +
      `childReviewの4項目はすべて必須で、ひらがなだけの短い1文ずつにすること。漢字、カタカナ、英字、数字は一切使わないこと。` +
      `childReviewでは難しい美術用語を避け、「かたち」「せん」「おおきさ」「ばしょ」など日常的なことばを使うこと。` +
      `childReviewでも、よいところを先に伝え、直す指示ではなく「こうすると もっと たのしくなるよ」のように前向きに伝えること。` +
      `childTipsはひらがなだけの短い語句にすること。漢字、カタカナ、英字、数字は一切使わないこと。`,
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
}): ClaudeContent[] => ([
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
