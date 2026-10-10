# 採用仕様とモデル選定（2026-10-05）

ユーザー承認によりprompt-v3 / rubric-v2を採用する。v4/v5は不採用の実験履歴として保持。品質を完全に保証する意味ではなく、27件レビューで妥当17・要確認9・不適切1という限界も保持する。採用時ファイルのSHA256：

- `prompt-v3.md`: `2b2e3686e89b64cda7a22e05c2501fee5890943189275a27a11b9b1aaa1062d6`
- `rubric-v2.json`: `500353d1215b63e519c6ad987ad281838e9d1ac16748a6fb1f16560eb7b3e7b4`

本番得点仕様はFをgame-score-v1として採用（2026-10-05ユーザー承認）。score-v2は補正前の基礎計算として保持する。固定アンカーは0→0、15→35、35→60、45→70、65→79、82→95、100→100、間は直線補間。基礎点とゲーム点をそれぞれ小数2桁に丸める。仕様はgame-score-v1.json。本番コードへの組み込みは実装済み。実APIによる品質・速度確認と公開は未実施。Sol lowは評価仕様の検証に使ったreferenceモデルであり、本番モデルの決定とは別。

## 6 Luna / noneの速度確認

公式モデル名は`gpt-6-luna`。画像入力・Responses API・reasoning.effort=noneは[公式仕様](https://developers.openai.com/api/docs/models/gpt-6-luna)で対応を確認。アカウントの現在の利用可否は確認していない。

既存の2026-09-23比較は両モデルnone、同じ画像、旧本番一次prompt、strict JSON Schema、6軸採点と通常/子ども講評。月別の測定は次の通り（平均秒）：

| 月 | 作品数 | 5.6 Luna | 6 Luna |
|---|---:|---:|---:|
| 4月 | 4 | 4.774 | 7.608 |
| 5月 | 5 | 4.332 | 7.116 |
| 6月 | 10 | 4.425 | 7.639 |
| 7月 | 13 | 4.787 | 6.265 |
| 8月 | 19 | 4.601 | 5.864 |
| 全体（作品数で加重） | 51 | 4.601 | 6.574 |

6 Lunaは約1.43倍、約1.97秒遅い。月別平均を作品数で加重した概算で、丸め誤差を含む。いずれの月も6 Lunaの平均が長い。過去の一時点・旧promptによる測定であり、現在やv3での性能保証ではない。遅ければ検証不要というユーザー方針に基づき、今回は追加API検証も本番モデル変更も行わない。当面5.6 Luna / noneを維持する。

資料：[4月](../../backend/draw/artifacts/model-compare-2026-04-gpt56-vs-gpt6-20260923.txt)、[5月](../../backend/draw/artifacts/model-compare-2026-05-gpt56-vs-gpt6-20260923.txt)、[6月](../../backend/draw/artifacts/model-compare-2026-06-gpt56-vs-gpt6-20260923.txt)、[7月](../../backend/draw/artifacts/model-compare-2026-07-gpt56-vs-gpt6-20260923.txt)、[8月](../../backend/draw/artifacts/model-compare-2026-08-gpt56-vs-gpt6-20260923.txt)。

リポジトリの既定値は`backend/draw/src/lib/env.ts`の`gpt-5.6-luna`と`none`。稼働Lambdaの環境設定は今回照会していない。また`openai.ts`のeffort検証は5.6 Luna以外のnoneを拒否するので、将来6 Lunaへ切り替える場合は環境変数だけの変更では足りない。

2026-10-05時点では「decisions API」の提供状況を確認できなかった。2026-10-09の再調査で公式のDecisions API公開βを確認。現時点の対応モデルはgpt-6-luna。その後、ユーザー承認を得て71回の実API測定を完了。本番採用は未実施。詳細はDECISIONS-REPORT.md。

## 2026-10-09 Decisions本番採用・反映

ユーザーは元のDecisions指示を採用。改良v4は不採用。新規投稿はDecisions gpt-6-lunaのMAP段階→F採点。非同期講評も追加指示によりgpt-6-luna / none Responsesを採用。本番反映と練習モードの実API/ブラウザ確認を完了。過去の点数・ランキング再計算は今回行わない。詳細はdocs/runbooks/draw-game-score-v1.md。上記の未公開・5.6維持という記述は当時の判断であり、この判断で更新された。
