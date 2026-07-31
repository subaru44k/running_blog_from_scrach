# 一次審査モデル比較レポート（2026-02投稿20件）

実行日: 2026-07-31

## 比較条件

- 同じ2026-02投稿画像20件
- 同じ一次採点プロンプト・同じ6軸rubric・同じサーバー側スコア式
- Responses API、画像入力
- 比較対象:
  - `gpt-5-mini` / `reasoning.effort=minimal`
  - `gpt-5.6-luna` / `reasoning.effort=none`
  - `gpt-5.6-luna` / `reasoning.effort=low`

## 最新価格

2026-07-31時点のOpenAI公式モデルページに基づく。推定費用には入力キャッシュ書き込み（通常入力価格の1.25倍）も反映した。

| モデル | 入力 | キャッシュ入力 | キャッシュ書き込み | 出力 |
| --- | ---: | ---: | ---: | ---: |
| GPT-5 mini | $0.25 / MTok | $0.025 / MTok | $0.3125 / MTok | $2.00 / MTok |
| GPT-5.6 Luna | $0.20 / MTok | $0.02 / MTok | $0.25 / MTok | $1.20 / MTok |

## 結果

| 条件 | 有効件数 | 無効形式 | 平均スコア | 範囲 | 平均レイテンシ | 推定合計費用 | 1件平均 |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| GPT-5 mini / minimal | 20 | 0 | 59.5 | 30–66 | 4.13秒 | $0.02273 | $0.00114 |
| Luna / none | 20 | 0 | 62.2 | 29–77 | 2.86秒 | $0.01944 | $0.00097 |
| Luna / low | 15 | 5 | 48.7* | 0–79 | 3.92秒 | $0.02140 | $0.00107 |

`*` Luna / low はJSONキー不一致の5件をスコア0として含む。形式が正しく返った15件だけでは平均64.9点（40–79）だった。

## 順位の安定性

- GPT-5 mini / minimal vs Luna / none: Spearman順位相関 `0.51`
- GPT-5 mini / minimal vs Luna / low（形式が正しかった15件）: `0.25`
- Luna / none vs Luna / low: `0.54`

今回の20件では、モデルを変えると順位がかなり動いた。Luna / noneはGPT-5 miniより平均スコアが2.7点高く、平均レイテンシは約31%短く、推定費用は約14%低かった。

## 互換性上の発見

- GPT-5 miniに `reasoning.effort=none` を指定するとAPI 400。対応値は `minimal/low/medium/high`。
- GPT-5.6 Lunaに `reasoning.effort=minimal` を指定するとAPI 400。対応値は `none/low/medium/high/xhigh/max`。
- Luna / lowの5件は、要求した英語キーではなく日本語キー（例: `採点`, `お題一致度`, `講評`）で返った。現在の本番正規化処理ではrubricが欠落扱いになって既定値で補完される可能性があり、講評も欠落する可能性がある。比較スクリプトでは欠落値を0として集計した。

## 結論

現時点の第一候補は `gpt-5.6-luna` / `reasoning.effort=none`。速度・費用・JSON形式の安定性では今回の比較で最もバランスが良かった。

ただし、順位相関は0.51に留まるため、既存ランキングをそのまま置き換える前に、少なくとも別月の投稿でも再現性を確認したい。導入時は、モデルIDだけでなくモデル別reasoning設定を追加し、Structured Outputsまたは日本語キーの正規化を併用してJSON形式を固定する必要がある。

## 生成物

- [GPT-5 mini / minimal JSON](model-compare-2026-02-2026-07-31T04-33-34-051Z.json)
- [Luna / none JSON](model-compare-2026-02-2026-07-31T04-32-26-641Z.json)
- [Luna / low JSON](model-compare-2026-02-2026-07-31T04-35-02-575Z.json)
- [Luna / minimal互換性確認 JSON](model-compare-2026-02-2026-07-31T04-38-30-941Z.json)
