# ADR 0001: 404ルーティング方針

- Status: Accepted
- Date: 2026-01-05

## Context
CloudFront配下で存在しないパスが 403/200 で返ると、検索エンジンの評価が悪化しうる（soft 404）。

## Decision
- 存在しないURLは HTTP 404 を返す
- 404の本文は Astro が生成する `/404.html` の内容を返す
- 404ページは canonical を出さず、robots は noindex,follow

## Consequences
- `/blog` や `/pace` のような非正規URLは 404 になる
- SPA の deep link を 200 で返す場合は、別方針が必要
