import {GetCommand,PutCommand,UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {SQSClient,SendMessageCommand} from '@aws-sdk/client-sqs';
import {json,options,parseJson} from '../lib/http.js';
import {rateLimit} from '../lib/rateLimit.js';
import {getObjectBuffer} from '../lib/s3.js';
import {computeInkRatio,isInkGateFail} from '../lib/inkGate.js';
import {ddb} from '../lib/ddb.js';
import {DRAW_BUCKET,DRAW_TABLE,SECONDARY_QUEUE_URL,PRACTICE_SUBMISSION_TTL_DAYS,RATE_LIMIT_SUBMIT,SUBMISSION_TTL_DAYS} from '../lib/env.js';
import {getClientIp} from '../lib/ip.js';
import type {SubmitResult} from '../types.js';
import {getCurrentMonthJst,resolveDrawPrompt} from '../lib/prompt.js';
import {getCurrentRank} from '../lib/ranking.js';
import {computeGameScore,toCompatibilityBreakdown} from '../lib/gameScore.js';
import {scoreWithDecisions,decisionsVersions,decisionsInstructionHash} from '../lib/decisions.js';
import {asPng} from '../lib/image.js';
const sqs=new SQSClient({});
const fromItem=(item:any):SubmitResult=>({submissionId:item.submissionId,score:item.score,breakdown:item.breakdown,oneLiner:item.oneLiner||'',tips:item.tips||[],childOneLiner:item.childOneLiner||'',childTips:item.childTips||[],reviewStatus:item.reviewStatus||'skipped',rankingEligible:item.rankingEligible!==false,isRanked:item.isRanked===true,...(typeof item.rank==='number'?{rank:item.rank}:{}),...(item.primaryRubric?{primaryRubric:item.primaryRubric,promptVersion:item.promptVersion,rubricVersion:item.rubricVersion,scoringVersion:item.scoringVersion,baseScore:item.baseScore,gameScore:item.gameScore}:{})});
const sortKey=(score:number,time:string,id:string)=>`${String(100-score).padStart(3,'0')}#${time}#${id}`;
export const handler=async(event:any)=>{
 const origin=event?.headers?.origin||event?.headers?.Origin;
 if(event?.requestContext?.http?.method==='OPTIONS')return options(origin);
 try{
  const {submissionId,imageKey,nickname}=parseJson(event);
  const match=/^draw\/(?:practice\/)?(prompt-\d{4}-\d{2})\/([^/]+)\.(?:png|webp)$/.exec(String(imageKey||''));
  if(!submissionId||!match||match[2]!==submissionId)return json(400,{error:'投稿情報が正しくありません。'},origin);
  const prompt=resolveDrawPrompt({promptId:match[1]}),promptId=prompt.promptId;
  const key={promptId,submissionId};
  // Duplicate requests reuse the immutable score and never overwrite a completed review.
  const previous=await ddb.send(new GetCommand({TableName:DRAW_TABLE,Key:key,ConsistentRead:true}));
  if(previous.Item)return json(200,fromItem(previous.Item),origin);
  await rateLimit(`ip#submit#${getClientIp(event)}`,RATE_LIMIT_SUBMIT);
  const bytes=await asPng(await getObjectBuffer(DRAW_BUCKET,imageKey)),createdAt=new Date().toISOString();
  const rankingEligible=prompt.month===getCurrentMonthJst()&&!String(imageKey).startsWith('draw/practice/');
  const gated=isInkGateFail(computeInkRatio(bytes));
  let measured:Awaited<ReturnType<typeof scoreWithDecisions>>|undefined;
  if(!gated){try{measured=await scoreWithDecisions(prompt.promptText,bytes);}catch(err){console.error('primary_decisions_failed',err instanceof Error?err.message:'failed');return json(503,{error:'採点できませんでした。少し待って再試行してください。'},origin);}}
  const points=measured?computeGameScore(measured.ratings):{score:0,baseScore:0,gameScore:0};
  const scoreSortKey=rankingEligible?sortKey(points.score,createdAt,submissionId):undefined;
  const rank=scoreSortKey&&!gated?await getCurrentRank(promptId,scoreSortKey):undefined;
  const reviewStatus=gated?'skipped':SECONDARY_QUEUE_URL?'pending':'failed';
  const item={...key,imageKey,createdAt,expiresAt:Math.floor(Date.now()/1000)+(rankingEligible?SUBMISSION_TTL_DAYS:PRACTICE_SUBMISSION_TTL_DAYS)*86400,nickname:String(nickname||'匿名').slice(0,20),promptText:prompt.promptText,rankingEligible,rankingStatus:rankingEligible?'active':'practice',isRanked:typeof rank==='number'&&rank<=20,rank,
   score:points.score,breakdown:measured?toCompatibilityBreakdown(measured.ratings):{likeness:0,composition:0,originality:0},baseScore:measured?points.baseScore:null,gameScore:measured?points.gameScore:null,
   oneLiner:gated?'線がほとんど見えないため、採点をスキップしました。':'',tips:[],childOneLiner:gated?'せんが ほとんど みえなかったので、てんすうは つけなかったよ。':'',childTips:[],reviewStatus,secondaryStatus:reviewStatus,secondaryAttempts:0,enrichedComment:null,childReviewVersion:gated?'v1-four-sentence':null,
   primaryProvider:measured?'openai-decisions':null,primaryModelId:measured?.modelId??null,primaryRubric:measured?.ratings??null,primaryAxisEvidence:null,primaryMeanLevels:measured?.means??null,primaryProbabilities:measured?.probabilities??null,primaryConfidence:measured?.confidence??null,primaryRequestId:measured?.requestId??null,primaryInstructionHash:measured?decisionsInstructionHash:null,
   primaryInputTokens:measured?.usage.inputTokens??null,primaryCachedInputTokens:measured?.usage.cachedInputTokens??null,primaryCacheWriteTokens:measured?.usage.cacheWriteTokens??null,primaryOutputTokens:measured?.usage.outputTokens??null,primaryTotalTokens:measured?.usage.totalTokens??null,primaryLatencyMs:measured?Date.now()-Date.parse(createdAt):null,primaryEstimatedCostUsd:measured?.estimatedCostUsd??null,
   promptVersion:measured?decisionsVersions.promptVersion:null,rubricVersion:measured?decisionsVersions.rubricVersion:null,scoringVersion:measured?decisionsVersions.scoringVersion:null,aiFallbackUsed:gated,tokenRecordedAt:new Date().toISOString(),secondaryModelId:null,secondaryInputTokens:null,secondaryOutputTokens:null,secondaryTotalTokens:null,secondaryLatencyMs:null,
   ...(scoreSortKey?{GSI1PK:promptId,scoreSortKey}:{})};
  try{await ddb.send(new PutCommand({TableName:DRAW_TABLE,Item:item,ConditionExpression:'attribute_not_exists(submissionId)'}));}catch(err:any){if(err?.name!=='ConditionalCheckFailedException')throw err;const saved=await ddb.send(new GetCommand({TableName:DRAW_TABLE,Key:key,ConsistentRead:true}));if(!saved.Item)throw err;return json(200,fromItem(saved.Item),origin);}
  if(reviewStatus==='pending'){
   try{await sqs.send(new SendMessageCommand({QueueUrl:SECONDARY_QUEUE_URL,MessageBody:JSON.stringify(key)}));}
   catch(err){console.error('review_enqueue_failed',err instanceof Error?err.name:'failed');item.reviewStatus='failed';item.secondaryStatus='failed';await ddb.send(new UpdateCommand({TableName:DRAW_TABLE,Key:key,UpdateExpression:'SET reviewStatus = :failed, secondaryStatus = :failed',ExpressionAttributeValues:{':failed':'failed'}}));}
  }
  return json(200,fromItem(item),origin);
 }catch(err:any){return json(err?.statusCode||500,{error:err?.statusCode===429?'アクセスが集中しています。時間をおいて再試行してください。':'送信に失敗しました。時間をおいて再試行してください。'},origin);}
};
