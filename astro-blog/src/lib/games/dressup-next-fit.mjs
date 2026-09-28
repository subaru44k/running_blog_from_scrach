// Fits use percentages of the shared 1024 × 1536 canvas, including the origin.
// An item can override one axis without losing its model's anatomical origin.
export const layerFitFor = (model, slot, itemId, layerKey) => {
  const itemFit = model.fit?.items?.[slot]?.[itemId] || {};
  const separateShoes = 'leftShoe' in itemFit || 'rightShoe' in itemFit;
  const correction = separateShoes ? itemFit[layerKey] || {} : itemFit;
  return { ...model.fit?.layers?.[layerKey], ...correction };
};

export const fitStyle = (fit = {}) => {
  const scale = Number.isFinite(Number(fit.scale)) ? Number(fit.scale) : 1;
  const scaleX = Number.isFinite(Number(fit.scaleX)) ? Number(fit.scaleX) : scale;
  const scaleY = Number.isFinite(Number(fit.scaleY)) ? Number(fit.scaleY) : scale;
  return `--layer-x:${fit.x || '0%'};--layer-y:${fit.y || '0%'};--layer-scale-x:${scaleX};--layer-scale-y:${scaleY};--layer-origin-x:${fit.originX || '50%'};--layer-origin-y:${fit.originY || '50%'}`;
};
