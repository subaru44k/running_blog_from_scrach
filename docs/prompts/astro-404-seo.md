# 404ページ SEO 調整プロンプト

## 目的
- 404ページのcanonicalを出さない
- 404ページを noindex,follow にする
- 他ページのSEO出力は変更しない

## 前提
- `src/layouts/Layout.astro` が canonical を出力している
- 404ページは `src/pages/404.astro`

## 変更範囲
- `src/layouts/Layout.astro`
- `src/pages/404.astro`

## 実行手順
1) Layoutでcanonical出力箇所を特定
2) `disableCanonical` と `noIndex` props を追加
3) 404ページから `disableCanonical={true}` と `noIndex={true}` を渡す
4) 他ページでは props を渡さず挙動維持
5) diff を提示

## 検証
- `/404.html` に canonical が出ない
- `/404.html` に `noindex,follow` が出る
- `/` や `/running-pace/` では canonical が出る

## 想定リスク
- Layout側でのprops追加ミスで全ページのSEOタグが変化する

## ロールバック
- Layoutの条件分岐を削除し、canonical固定出力に戻す
- 404ページのprops指定を削除
