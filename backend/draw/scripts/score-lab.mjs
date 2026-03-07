import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.DRAW_TABLE || 'DrawSubmissions';
const targetMonth = process.argv[2] || '2026-02';
const promptId = `prompt-${targetMonth}`;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const clampScore = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

const summary = (name, scores) => {
  const sorted = [...scores].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p10 = sorted[Math.floor((sorted.length - 1) * 0.1)];
  const p50 = sorted[Math.floor((sorted.length - 1) * 0.5)];
  const p90 = sorted[Math.floor((sorted.length - 1) * 0.9)];
  const unique = new Set(sorted).size;
  const bins = {
    lt60: sorted.filter((s) => s < 60).length,
    s60_69: sorted.filter((s) => s >= 60 && s < 70).length,
    s70_79: sorted.filter((s) => s >= 70 && s < 80).length,
    s80_89: sorted.filter((s) => s >= 80 && s < 90).length,
    s90p: sorted.filter((s) => s >= 90).length,
  };
  return { name, count: sorted.length, min, p10, p50, p90, max, mean: mean.toFixed(2), unique, bins };
};

const queryAllByPromptId = async (pk) => {
  const items = [];
  let ExclusiveStartKey;
  do {
    const out = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'promptId = :pk',
      ExpressionAttributeValues: { ':pk': pk },
      ExclusiveStartKey,
    }));
    items.push(...(out.Items || []));
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
};

const formulaCurrent = (r) => {
  const weighted =
    r.promptMatch * 24 +
    r.composition * 16 +
    r.shapeClarity * 18 +
    r.lineStability * 12 +
    r.creativity * 16 +
    r.completeness * 14;
  const base = weighted / 10;
  const values = [r.promptMatch, r.composition, r.shapeClarity, r.lineStability, r.creativity, r.completeness];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const spread = Math.sqrt(variance) * 2.2;
  const synergy = Math.max(0, r.promptMatch - 7) * Math.max(0, r.creativity - 7) * 0.8;
  const penalty = Math.max(0, 6 - r.completeness) * 1.8;
  return clampScore(base + spread + synergy - penalty);
};

const formulaWeightedNonlinearA = (r) => {
  const core =
    r.promptMatch * 30 +
    r.shapeClarity * 18 +
    r.composition * 14 +
    r.lineStability * 10 +
    r.creativity * 12 +
    r.completeness * 16;
  const base = 34 + core / 10;
  const top2 = [r.promptMatch, r.shapeClarity, r.creativity, r.composition, r.lineStability, r.completeness]
    .sort((a, b) => b - a)
    .slice(0, 2);
  const bonus = Math.max(0, top2[0] - 7) * 2.8 + Math.max(0, top2[1] - 7) * 1.6;
  const promptPenalty = Math.max(0, 7 - r.promptMatch) * 4.2;
  const weakPenalty = [r.promptMatch, r.shapeClarity, r.composition, r.lineStability, r.creativity, r.completeness]
    .filter((v) => v < 6)
    .reduce((acc, v) => acc + (6 - v) * 2.4, 0);
  const excellence = r.promptMatch >= 9 && r.shapeClarity >= 9 && r.creativity >= 8 ? 7 : 0;
  return clampScore(base + bonus + excellence - promptPenalty - weakPenalty);
};

const formulaWeightedNonlinearB = (r) => {
  const weighted =
    r.promptMatch * 3.8 +
    r.shapeClarity * 2.3 +
    r.composition * 1.7 +
    r.lineStability * 1.2 +
    r.creativity * 1.9 +
    r.completeness * 2.1;
  const values = [r.promptMatch, r.shapeClarity, r.composition, r.lineStability, r.creativity, r.completeness];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rangeBonus = (max - min) * 1.8;
  const creativeLift = r.creativity >= 8 ? (r.creativity - 7) * 3.2 : 0;
  const eliteLift = r.promptMatch >= 9 && r.shapeClarity >= 8 ? 6 : 0;
  const floorPenalty = min < 5 ? (5 - min) * 5.5 : 0;
  return clampScore(22 + weighted + rangeBonus + creativeLift + eliteLift - floorPenalty);
};

const main = async () => {
  const items = await queryAllByPromptId(promptId);
  const rows = items
    .filter((item) => item.primaryRubric)
    .map((item) => ({
      submissionId: String(item.submissionId),
      score: Number(item.score ?? 0),
      rubric: item.primaryRubric,
    }));

  if (rows.length === 0) {
    console.error(`No rubric rows found for ${promptId}`);
    process.exit(1);
  }

  const currentScores = rows.map((row) => formulaCurrent(row.rubric));
  const variantAScores = rows.map((row) => formulaWeightedNonlinearA(row.rubric));
  const variantBScores = rows.map((row) => formulaWeightedNonlinearB(row.rubric));

  console.log(`Prompt: ${promptId}`);
  console.log(JSON.stringify(summary('current', currentScores), null, 2));
  console.log(JSON.stringify(summary('variantA', variantAScores), null, 2));
  console.log(JSON.stringify(summary('variantB', variantBScores), null, 2));

  console.log('\nTop differences (variantB - current):');
  const diffs = rows.map((row, idx) => ({
    submissionId: row.submissionId,
    current: currentScores[idx],
    variantA: variantAScores[idx],
    variantB: variantBScores[idx],
    diffB: variantBScores[idx] - currentScores[idx],
  })).sort((a, b) => Math.abs(b.diffB) - Math.abs(a.diffB));
  for (const row of diffs.slice(0, 12)) {
    console.log(`${row.submissionId} current=${row.current} variantA=${row.variantA} variantB=${row.variantB} diffB=${row.diffB}`);
  }
};

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
