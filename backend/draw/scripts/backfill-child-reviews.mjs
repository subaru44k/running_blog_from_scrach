import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.DRAW_TABLE || 'DrawSubmissions';
const SECRET_ID = process.env.OPENAI_API_KEY_SECRET_ID || 'draw/openai-api-key';
const MODEL_ID = process.env.PRIMARY_MODEL_ID || 'gpt-5.6-luna';
const START_MONTH = process.env.START_MONTH || '2026-02';
const apply = process.argv.includes('--apply');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 1) : Infinity;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const secrets = new SecretsManagerClient({ region: REGION });
const CHILD_TEXT_PATTERN = /^[\u3040-\u309f\u3000 、。！？・\s]+$/u;
const CHILD_REVIEW_VERSION = 'v1-four-sentence';

const currentMonthJst = () => new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  timeZone: 'Asia/Tokyo',
}).format(new Date());

const monthRange = (start, end) => {
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  const months = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      year += 1;
      month = 1;
    }
  }
  return months;
};

const validChildReview = (item) => {
  const tips = Array.isArray(item.childTips) ? item.childTips : [];
  return item.childReviewVersion === CHILD_REVIEW_VERSION
    && CHILD_TEXT_PATTERN.test(String(item.childOneLiner || '').trim())
    && tips.length >= 2
    && tips.every((tip) => {
      const text = String(tip || '').trim();
      return CHILD_TEXT_PATTERN.test(text) && text.length <= 16 && !/[。！？]/u.test(text);
    });
};

const outputText = (payload) => (payload.output || [])
  .flatMap((block) => block.content || [])
  .filter((content) => content.type === 'output_text')
  .map((content) => content.text || '')
  .join('\n')
  .trim();

const loadApiKey = async () => {
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  if (!response.SecretString) throw new Error(`Secret ${SECRET_ID} has no SecretString`);
  try {
    const parsed = JSON.parse(response.SecretString);
    return parsed.apiKey || parsed.OPENAI_API_KEY || parsed.key || response.SecretString;
  } catch {
    return response.SecretString;
  }
};

const generateChildReview = async (apiKey, item) => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_ID,
      reasoning: { effort: 'none' },
      text: {
        format: {
          type: 'json_schema',
          name: 'draw_child_review_backfill',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['childReview', 'childTips'],
            properties: {
              childReview: {
                type: 'object',
                additionalProperties: false,
                required: ['summary', 'goodPoint', 'improvement', 'nextStep'],
                properties: {
                  summary: { type: 'string' },
                  goodPoint: { type: 'string' },
                  improvement: { type: 'string' },
                  nextStep: { type: 'string' },
                },
              },
              childTips: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
            },
          },
        },
      },
      input: [{
        role: 'user',
        content: [{
          type: 'input_text',
          text: `つぎの おえかきこうひょうを、よんさいの こどもが じぶんで よめる ことばに いいかえてください。\n` +
            `かんじ、かたかな、えいじ、すうじは いっさい つかわず、ひらがなと くとうてんだけで かいてください。\n` +
            `よいところを さきに ほめ、つぎに できる くふうを やさしく つたえてください。\n` +
            `こうひょうは よっつの こうもくに、ひとつずつ みじかい ぶんを かいてください。\n` +
            `こつは にこから さんこの、じゅうろくもじ いないの みじかい ことばに してください。こつに まるは つけません。\n` +
            `もとの こうひょう: ${String(item.oneLiner || '')}\n` +
            `もとの こつ: ${(Array.isArray(item.tips) ? item.tips : []).join('、')}`,
        }],
      }],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const parsed = JSON.parse(outputText(payload));
  const reviewParts = ['summary', 'goodPoint', 'improvement', 'nextStep']
    .map((key) => String(parsed.childReview?.[key] || '').trim());
  const childOneLiner = reviewParts.join(' ');
  const childTips = Array.isArray(parsed.childTips) ? parsed.childTips.map((tip) => String(tip).trim()) : [];
  if (reviewParts.some((part) => !part || !CHILD_TEXT_PATTERN.test(part))
    || childTips.length < 2
    || !childTips.every((tip) => CHILD_TEXT_PATTERN.test(tip) && tip.length <= 16 && !/[。！？]/u.test(tip))) {
    throw new Error('Generated child review contains unsupported characters');
  }
  return { childOneLiner, childTips, modelId: payload.model || MODEL_ID };
};

const months = monthRange(START_MONTH, currentMonthJst());
const items = [];
for (const month of months) {
  const promptId = `prompt-${month}`;
  const response = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :promptId',
    ExpressionAttributeValues: { ':promptId': promptId },
    ScanIndexForward: true,
    Limit: 20,
  }));
  for (const item of response.Items || []) {
    if (!validChildReview(item)) items.push(item);
  }
  console.log(`${promptId}: ${(response.Items || []).length} top entries, ${items.filter((item) => item.promptId === promptId).length} need backfill`);
}

if (!apply) {
  console.log(`dry-run: ${items.length} submissions need child reviews; rerun with --apply`);
  process.exit(0);
}

const apiKey = await loadApiKey();
let updated = 0;
let failed = 0;
for (const item of items.slice(0, limit)) {
  try {
    let generated;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        generated = await generateChildReview(apiKey, item);
        break;
      } catch (error) {
        lastError = error;
        console.warn(`attempt ${attempt} failed for ${item.promptId}/${item.submissionId}: ${error.message}`);
      }
    }
    if (!generated) throw lastError || new Error('Child review generation failed');
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { promptId: item.promptId, submissionId: item.submissionId },
      UpdateExpression: 'SET childOneLiner = :comment, childTips = :tips, childReviewModelId = :model, childReviewBackfilledAt = :at, childReviewVersion = :version',
      ExpressionAttributeValues: {
        ':comment': generated.childOneLiner,
        ':tips': generated.childTips,
        ':model': generated.modelId,
        ':at': new Date().toISOString(),
        ':version': CHILD_REVIEW_VERSION,
      },
    }));
    updated += 1;
    console.log(`updated ${item.promptId}/${item.submissionId}`);
  } catch (error) {
    failed += 1;
    console.error(`failed ${item.promptId}/${item.submissionId}:`, error.message);
  }
}

console.log(JSON.stringify({ needed: items.length, attempted: Math.min(items.length, limit), updated, failed }));
if (failed > 0) process.exitCode = 1;
