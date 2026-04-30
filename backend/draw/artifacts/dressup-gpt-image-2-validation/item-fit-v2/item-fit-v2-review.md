# Dressup Item Fit V2 Manual Review

- Base: `style-d-encyclopedia-clean-base`
- Preview: `item-fit-v2-preview.html`

## Necklace

- Symmetry: PARTIAL PASS. v1 より左右対称に近いが、モデルの肩・襟ラインに対して左右端の乗り方はまだ完全には自然ではない。
- Center alignment: PASS. ペンダントは体の中心線付近に来ている。
- Neckline fit: PASS. 横幅は控えめで、肩幅超過は起きていない。
- Alpha edge: PASS. 全身プレビューでは白縁は目立たない。
- Verdict: necklace は prompt 改善 + slot 正規化で実用に近い。次は neckline guide を見ながら y 位置を数 px 下げる程度でよい。

## Footwear patch

- Left foot fit: PARTIAL PASS. 靴の横位置は大きく外れていない。
- Right foot fit: PARTIAL PASS. v1 の右足ズレよりは改善したが、生成 patch 全体の足幅・足首幅が base と合っていない。
- Base foot hidden correctly: PASS for toe/foot hiding. 元の足指や足線が靴の下から見える問題は解けている。
- Ankle connection: FAIL. 生成物が足首より上の筒状の脚を含み、base の脚と自然につながらない。
- Patch size: FAIL. `footwearPatch` の bbox が縦に長く、mask rect 内で脚の差替え感が強い。
- Verdict: 足込み patch は「靴下から足が見える」問題を解けるが、今の人物ベースに対して脚の再生成まで入ると不自然。次は `shoeBody + footOcclusionMask`、つまり靴本体だけを生成し、足指・足先だけをマスクで隠す方式を検証する方がよい。

## Next action

- Necklace: symmetric heart pearl fit: keep as acceptable validation baseline.
- Footwear patch: Mary Jane fit: do not expand as-is; test a shoe-only asset with a separate toe/forefoot mask, or restrict shoes to boots/high-coverage shoes if mask authoring becomes too costly.
