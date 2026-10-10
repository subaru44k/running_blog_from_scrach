# お絵描き評価ラボ

本番サイトから独立したローカル検証ツール。Node.js 20+。新しいnpm依存なし。取得だけは既存 `backend/draw` の AWS SDK / esbuild を利用する（必要なら `npm ci --prefix backend/draw`）。OpenAI API client、key読込、モデル推論、自動課金フォールバックは持たない。既存のAPI課金を伴う `model-compare.mjs` とは別ツール。

リポジトリルートから:

```sh
# 既存認証でDynamoDB Query + S3 GetObjectのみ。AWS通常読取費用はあり得る。
AWS_PROFILE=codex-prod node tools/draw-evaluation/export.mjs
# 既存データを上書きしない。別セットは出力先と月を指定。
AWS_PROFILE=codex-prod node tools/draw-evaluation/export.mjs tools/draw-evaluation/data-next 2026-10
node tools/draw-evaluation/server.mjs
# http://127.0.0.1:4317
# Ctrl-C で停止。別データは server.mjs tools/draw-evaluation/data-next
node --test tools/draw-evaluation/*.test.mjs
```

PORTでポート変更可能。127.0.0.1限定、外部公開はしない。保存はローカルJSONのatomic rename。二重サーバー起動をlockで拒否。異常終了後の `.server.lock` は実プロセスが停止済みであることを確認してから削除する。サーバー起動中はCLI取込を拒否する。画像・データはgitignore対象の `data*/` に置く。バックアップはディレクトリ全体をコピーする。

## 現行構成の調査

- Astro `/draw/`, `/draw/play/`, `/draw/result/`, `/draw/archive/`、React UI。30秒、白背景PNG。
- サーバーの `backend/draw/src/lib/prompt.ts` が月次お題を確定する。投稿側の任意お題を信用しない。
- S3署名PUTで画像保存、CloudFront署名URLで表示。DynamoDB `DrawSubmissions` にお題・imageKey・primaryRubric・score・講評・model・fallback等を保存。
- `src/lib/openai.ts` は GPT-5.6 Luna / none に画像理解・6軸rubric・通常/子ども講評を同時依頼。失敗時stub、描画量が少ない画像はink gateで採点スキップ。
- `src/handlers/submit.ts` の重みはお題.30、形.22、完成度.16、構図.14、創意.10、線.08。加点はお題>=8で5、形>=6で2、完成>=6で2、線>=6で3、全条件で追加5、お題<=4で-6。通常20〜100、ink gateは0。
- GSIのscoreSortKey（反転点数・日時・ID）でランキング。月次cleanupで過去月Top20を残し、他画像を削除する。全過去作品の復元は保証できない。
- 既存テストはTypeScript typecheckと各用途のスクリプトが中心。今回の採点/取込/レビュー/統計はNode testを追加。

## 暫定rubricとscore

詳細な軸別境界は `rubric-v1.json`、評価指示は `prompt-v1.md` が正。

| 軸 | 重み | 意図 |
|---|---:|---|
| お題らしさ | 50 | 対象固有の手掛かりで識別できるか |
| 構造 | 30 | 部位と配置を読めるか。線の滑らかさや写実性は不要 |
| 完成度 | 20 | 対象の絵としてまとまるか。簡潔な線画も完成と認める |

各軸0〜4の5段階。3段階では同点を増やし、7段階では曖昧な境界を細分化し過ぎると考え、まず5段階にする。これは実測による最適性の証明ではない。好みに依存しやすい創意工夫、端末/運動技能に左右される線の安定性は除外。お題らしさと構造の重複は後続の反復評価で確認する。

score-v1 = `(お題*50 + 構造*30 + 完成*20) / 4`。お題0なら25点上限。白紙・文字だけ・全面単色は全軸0。小数.5を保持、2.5点単位、125組合せで39種類。AIから受け取ったscoreは使わず再計算。自由な100点生成は禁止。旧採点は保存値を保ち、新rubricへ無理に変換しない。rubric/prompt/scoring変更時は旧ファイルを変更せず新バージョンとvalidator/scorerを追加する。

## Codexサブスクリプションで評価

アプリからモデルを呼ばない。GPT-6.1 Sol / lowを明示できるCodexセッション、またはユーザーが許可した評価専用サブエージェントで行う。指定できなければ停止して制約を報告し、別モデルやAPIへ自動切替しない。

1. `data/packet.json`、画像、`prompt-v1.md`、`rubric-v1.json`だけを評価担当へ渡す。`dataset.json`は既存点数/講評を含むため渡さない。
2. packetの作品IDと画像を一対一に確認。画像を実際に開いて評価する。5〜10件単位を推奨。同じ条件の一巡は同じrun_id（例 `reference-20261005-01`）、反復は同じrun_idと新しいevaluation idで蓄積する。条件を変える場合はrun_idも変更。
3. JSON配列を `data/reference.json` に保存。model_versionは実際のsnapshotが不明なら `gpt-6.1-sol (snapshot unavailable)` と記録。申告provenanceをvalidatorが検証するが実際の実行モデルの暗号学的証明ではない。
4. サーバー停止後に取込、再起動:

```sh
node tools/draw-evaluation/cli.mjs import tools/draw-evaluation/data/reference.json
node tools/draw-evaluation/server.mjs
node tools/draw-evaluation/cli.mjs summary all
node tools/draw-evaluation/cli.mjs summary accepted
```

取込は全件を検証してから保存。重複ID、未知作品、画像hash不一致、未対応version、不正な段階を拒否する。snapshot/既存prompt version/effortが不明な過去結果はunknownと記録し、Luna noneだと断定しない。画像ファイルを変更しないこと（packet/hashは取得時の同一性を示す）。

## データ・レビュー・比較

`dataset.json` の drawings / evaluations / reviews は独立配列。Evaluationはid/drawing_id/model/model_version/effort/execution_source/prompt/rubric/scoring/run/ratings/calculated_score/confidence/短い観察と理由/日時。同一作品の複数評価を上書きせず追加する。EvaluationReviewはevaluation_id/status/note/reviewed_at。最新レビューを表示し、過去レビューも保持。

UIで「妥当」「要確認」「不適切」とメモを保存。人間の未実施レビューを自動で妥当にはしない。「妥当」だけの統計と全件暫定統計を切替可能。不適切の原記録は削除しない。修正はevaluator_type=human-correctionで新しい評価を追加し、元評価を不適切にする。MVPはUIで段階の編集を提供しない。

比較はmodel/effort/version/run条件ごと。同一作品の反復評価の平均点・母分散・最大点差・rubricのペア一致率、得点帯と同点ペア率を表示。両群の共通作品のみで同点を平均順位にしたSpearmanと平均絶対点差を計算。定数群や2件未満の順位相関はnull。異なるrubricでも点数・順位比較は可能だが軸一致率は直接比較しない。runを跨ぐ比較は別群となる。標本は過去保存Top20と現存画像に偏り、母集団の性能推定には使えない。

Decision APIは未導入。次は人間レビュー、欠けた白紙/全面塗り/文字などのケース補充、同じ画像5〜10回の独立反復、配点・段階の再検討。その後、新方式の出力を別candidateとして取り込む。後段講評はvisual_observations/positive_points/improvement_pointsを使い、画像あり/なしで比較できる。

## 優先レビュー一覧

画面の「優先レビュー（未レビュー）」を選ぶ。選択した版の未レビューのSol初回referenceについて、90点以上、confidence low、既存点数との差が25点以上のいずれかを満たす作品を、条件の重なりが多い順に表示する。各カードに確認理由を表示する。v2では、v1で要確認・不適切とレビューした作品も確認対象にする。旧レビューの判定をv2へコピーはしない。「既存採点を隠す」は初期ONで、差の実数は提示しない。条件は確認漏れを防ぐための目安で、評価の正誤を断定しない。レビュー保存後は残件数と一覧が更新される。既存レビューはそのまま保持する。優先一覧が終わったら、中得点作品と同点作品の比較を追加し、rubric改訂の材料にする。

## rubric-v2 / score-v2（実験版）

v1とレビューは保持したまま、4軸×7段階のv2を追加。お題らしさ40%、特徴の表現25%、形の整合性20%、仕上がりの質15%。3〜4は通常の成立、5は明確に良い、6は例外的。旧「完成している」基準を「仕上がりの質」に変え、特徴と形の関係を別軸で確認する。3軸→4軸、5段階→7段階、境界/配点も同時に変えた探索実験なので、改善を特定の変更一つの効果だと断定しない。各最高段階には、その一つ下を超える具体的な可視的根拠二つをaxis_evidenceに要求する。

段階の変換値 `[0,10,25,45,65,82,100]` に各重みを掛けて加算。お題0/1/2の上限は15/35/55。小数2桁、最大770種類の得点を取れるが、実分布は別途確認する。配点は版固定、同点をランダム値やIDで崩さない。これはAIに連続値を自由生成させる方式ではない。狙いは中〜高評価の根拠を厳格にし、作品差を離散判断で表現できるか検証すること。

`prompt-v2.md` と `rubric-v2.json` を評価担当へ渡す。出力は同じentity構造でversionsをv2にし、4軸のaxis_evidenceを追加する。v1/v2のprompt/rubric/scoringを混ぜる取込は拒否。score値は再計算。実ファイルhashを確認してから取込する。

画面の「評価版」でv1/v2を切替。初期は新しい版、表示・レビュー残数は初回評価だけが対象。旧版の点数・人間レビューはカードの「前の評価・あなたのレビューを見る」で確認できる。同じ作品の反復は「独立反復評価」を開いて比較でき、別ID・別レビューとして保持する。統計は同じrunの全反復を作品ごとに平均するため、初回のみの実験集計と値が異なる場合がある。

初回42作品に加え、レビューで問題のあった上位/曖昧な作品と、妥当だった低得点/白紙を含む8作品を、履歴を見ない新規Sol lowサブエージェントで2回追加評価（計3回）する。これは予備安定性試験であり、5〜10回の本試験の代わりにはならない。複数担当の個別作業は同じモデル/effort/promptの条件を固定するが、モデルsnapshotやseed固定はできない。

23件の人間レビューを基に作ったrubricを同じ画像で試しているため、独立したholdoutによる品質改善の証明ではない。本番採用の前にv2人間レビューと未使用画像による確認が必要。詳細結果は `V2-REPORT.md`。

## prompt-v3（指示のみの比較）

rubric-v2.jsonの軸・0〜6の段階・score-v2は変更しない。prompt-v3.mdで類似対象との識別、顔だけではなく描かれた全体の品質、簡潔でも明快な良い絵への段階5の根拠を具体化する。許可する組合せはprompt-v1/rubric-v1/score-v1、prompt-v2/rubric-v2/score-v2、prompt-v3/rubric-v2/score-v2のみ。

評価条件の選択はprompt/rubric/scoring/runごと。新しいpromptを初期表示し、同じrubricの違うpromptを反復として混ぜない。比較パネルは直前のpromptの評価・レビューを表示する。prompt-v3では、前回「妥当」だった作品の段階が変わった場合も優先確認に含める。

v2レビュー済み28作品（要確認・不適切16、妥当12）を、点数やレビューを見せず新規Sol low担当で評価する。うちv2反復対象と重なる7作品をさらに独立に2回追加評価し、両条件の同じ7作品で安定性を比較する。旧条件の原記録は維持し、旧レビューを新条件へ転記しない。点数変換は固定するので、段階が同じなら最終点も必ず同じ。改善の判断は人間による新条件の確認が必要。

実行結果と次に確認する代表6件は [P3-REPORT.md](./P3-REPORT.md) を参照。再集計は `node tools/draw-evaluation/analyze-p3.mjs`。段階の変化を自動で改善と扱わず、以前の妥当な評価への影響も人間レビューで確認する。

## 識別・品質の切り分け実験

prompt-v4はprompt-v3に対象識別の競合候補確認だけを追加、prompt-v5は品質境界の確認だけを追加する。いずれもrubric-v2/score-v2固定。明確な指摘8件と妥当な対照4件を含む同じ12作品で、prompt-v3も新規実行して通常の揺れと比較する。単回ずつの小規模実験なので因果効果は確定しない。v4/v5のレビュー比較元はprompt-v3の初回で、条件選択にはrun_idも表示する。

比較結果・採用見送りの理由は [ISOLATION-REPORT.md](./ISOLATION-REPORT.md) を参照。再集計：`node tools/draw-evaluation/analyze-isolation.mjs`。

## 採用状態

prompt-v3 / rubric-v2をユーザー承認済みの採用仕様とする。v4/v5は不採用の実験候補。本番得点仕様はF（game-score-v1）を採用済み。score-v2は補正前の基礎計算として保持し、本番公開は未実施。モデル速度の既存測定と当面5.6 Luna / none維持の判断は [ADOPTION.md](./ADOPTION.md) を参照。

## 本番得点候補の比較

`http://127.0.0.1:4317/score-comparison` で採用v3の初回評価を固定した4候補を確認できる。全件と妥当のみ、整数/小数表示の同点率、順位変化、反復感度、画像別比較を表示する。元の評価・レビューは上書きしない。計算はscore-candidates.mjs、結果と判断は [SCORE-REPORT.md](./SCORE-REPORT.md)。Aの基礎計算にFを補正として適用するgame-score-v1を採用済み。仕様はgame-score-v1.json、本番公開は未実施。

ゲーム用補正E/F/Gも比較画面に追加。Aの段階・重み・上限適用後に固定した区分線形換算を行い、投稿集合ごとの相対補正はしない。推奨Fは全軸3→70、4→79、5→95点。現在28作品の平均62.42、最高91.80。補正後のお題上限と整数丸めによる同点も表示する。詳細はSCORE-REPORT.mdの追加比較を参照。

## 本番コードへの組み込み状態

backend/drawの新規採点・保存・詳細APIと、Astroの結果/アーカイブ表示にprompt-v3 / rubric-v2 / game-score-v1を組み込み済み。正本をビルド時に直接取り込む。baseScore/gameScoreは小数2桁、公開scoreは整数。過去投稿は再計算しない。実API品質・速度検証と公開は未実施。検証・公開時の確認事項は [runbook](../../docs/runbooks/draw-game-score-v1.md) を参照。

## Luna / low の予備比較

ユーザー承認により、同じ採用v3初回28作品をGPT-5.6 Luna / lowとGPT-6 Luna / lowのsubscription評価専用担当でblind比較する。candidateとして保存し、UIはモデル/effort/typeも含む条件でレビューを分離する。判定元はSolの採用v3初回で、レビューは転記しない。`analyze-luna.mjs`は採用Fでゲーム点を再計算し、全件・人間の妥当集合・指摘集合の軸一致、段階誤差、順位相関、点差を報告する。noneやAPIの速度・品質検証とは異なり、ここでは本番再採点もランキング更新も行わない。実行できなかったモデルは欠測として明記する。

2026-10-05の実行結果：6 Luna / lowの28件を取込済み。5.6 Luna / lowは3試行ともcapacityエラーで未測定。結果と次の判断は [LUNA-PILOT-REPORT.md](./LUNA-PILOT-REPORT.md)。6 Lunaの予備結果だけでは過去ランキング更新に進まない。

モデル専用promptの調整は [LUNA-TUNING-PROTOCOL.md](./LUNA-TUNING-PROTOCOL.md) に従う。Luna専用v1/v2もrubric-v2 / score-v2を固定し、最終集合の比較元は新規blind Sol v3教師。既存レビューは引き継がない。

初回の専用2案は不採用、共通v3を維持。最終集合での再現性の問題と優先確認リンクは [LUNA-TUNING-REPORT.md](./LUNA-TUNING-REPORT.md)。

## GPT-5.6 Luna専用promptの検証

2026-10-06の再試行ではsubscription lowが利用でき、17件の共通v3基準評価を取得。調整は17件の人間確認済みSol教師だけを使用し、最大2専用案を段階MAE→F点MAEで選択。最終確認用は既存42件のID・画像hashを除外した新しい保存画像18件を月別3件ずつ固定する。最終ラベルを開く前にpromptと分割のhashを`freeze-luna56-tuning.mjs`で固定する。`analyze-luna56-tuning.mjs`で集計。noneや本番の採用判断は含まない。

新規集合のread-only取得例：`node tools/draw-evaluation/export.mjs tools/draw-evaluation/data-luna56-fresh --exclude tools/draw-evaluation/data/dataset.json`。既存出力を上書きしない。画像とローカルデータはGit管理外。

5.6 Lunaの最終結果：専用v1は新規18件で共通v3を上回らず、専用2案とも本番採用は見送り。[LUNA56-TUNING-REPORT.md](./LUNA56-TUNING-REPORT.md) に数値、制約、優先確認作品を保存。

## Decisions APIの実測準備

提供状況・型の違い・測定計画は [DECISIONS-REPORT.md](./DECISIONS-REPORT.md)。`benchmark-decisions.mjs`は既定でオフラインdry-run。4つのscore質問と連続値/段階別確率を保持し、MAP段階のみ既存Fへ換算する。API key使用・課金は承認後のopt-inで、Sol教師生成は従来どおりsubscription。原回答は既存の文章根拠付き評価へ混ぜない。

Decisions初回実API測定は承認を得て完了。71回成功、中央値0.331秒、95％点0.688秒、概算$0.028694。35作品の2回はMAP一致だが、Sol点との差は確認済み17件12.89点・別18件10.85点。速さと今回の反復一致は確認できたが、教師への一致は未達で本番移行は行っていない。詳細はDECISIONS-REPORT.md。

実測Decisions比較の全35枚は http://127.0.0.1:4317/model-comparison で画像・4軸rubric・F点数を確認できる。既存17枚と追加18枚を分け、低評価作品も表示する。Sol、共通v3の5.6 Luna low、評価済み作品のみ6.0 Luna low、Decisions MAPを比較する。根拠・レビューの確認は従来画面を使う。

Decisions一般プロンプトの最大10バッチ・追加1ドルの調整結果は `DECISIONS-TUNING-REPORT.md`。既存17枚で9候補、開発選択v4を追加18枚で1回確認した。追加セットで改善は再現しなかったため本番未採用。`/model-comparison` に元の指示とv4を並べて表示する。
