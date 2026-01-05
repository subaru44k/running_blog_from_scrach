# PDF圧縮フロー変更プロンプト

## 目的
- 署名URL → アップロード → 圧縮の流れを維持
- UIを高速化し、圧縮候補を並列生成
- 404/SEOの方針と矛盾しない説明文に整える

## 前提
- フロント: `astro-blog/src/pages/pdf-compress.astro`
- バックエンド: `pdf-compress-service/lambda.js`
- AWS CLI は使わない

## 変更範囲
- フロントのAPI呼び出し
- Lambdaのレスポンス形式
- UIの説明文（必要な範囲のみ）

## 実行手順
1) フロントで /compress を level=1/2/3 で並列呼び出し
2) それぞれのレスポンスを3候補として表示
3) keepSource を付与して削除競合を回避
4) 単体レスポンスでも previewUrl を返す
5) diff と検証手順を提示

## 検証
- 3候補が並ぶ
- preview が表示される（best-effort）
- 上限サイズのおすすめロジックが動く

## 想定リスク
- S3の削除タイミング競合
- preview生成失敗時のUI表示

## ロールバック
- /compress の multi=true に戻す
- previewUrl 表示を無効化
