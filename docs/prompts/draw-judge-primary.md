# Decisions一次採点と非同期講評の指示

採点はOpenAI Decisions gpt-6-luna。元の評価済み指示を採用し、改良v4は使わない。指示版はdecisions-original-v1。正本prompt-v3.mdの「各軸のaxis_evidence」より前の指示＋rubric-v2.rulesを入力側に配置し、各質問に軸名の独立評価指示と原文の7段階定義を入れる。tools/draw-evaluation/decisions.mjsとbackend/draw/src/lib/decisions.tsの要求内容・SHA256が完全一致するテストを持つ。

4質問の確率合計、段階値、平均score、confidenceを検証し、最頻段階MAPを0〜6整数rubricにする。確率同点は低い段階。平均段階は診断用だけに保存し、既存Fの得点計算に使わない。AIは最終点や文章のaxis_evidenceを生成しない。

確定後の講評はSQS workerがGPT-6 Luna / none Responsesで別生成する。reviewとchildReviewのsummary / goodPoint / improvement / nextStepの各1文、tips/childTipsを要求し、画像と確定rubricを渡す。得点・rubricの再評価を要求しない。通常はやさしい日本語、子ども向けはひらがなの短い文。点数や順位の更新権限を処理コードに持たせない。文契約はbackend/draw/src/lib/review.tsに定義する。

採点失敗は503で保存・ランキング登録なし。講評失敗は点数を保持しreviewStatus=failed。線がないときはインクゲート0点、講評スキップ。旧投稿は再採点しない。
