// Same clockwise layout as main/action_layout.h, in the device's 240×320 pixels.
window.actionBounds = function (count, index) {
  const width = count <= 4 ? 88 : count <= 6 ? 84 : count <= 8 ? 76 : 72;
  const height = count <= 4 ? 54 : count <= 6 ? 52 : count <= 8 ? 48 : 44;
  const top = count === 2 ? 0 : count <= 4 ? 1 : count <= 8 ? 2 : 3;
  const bottom = count <= 3 ? 0 : count <= 5 ? 1 : top;
  const right = Math.floor((count - top - bottom + 1) / 2);
  const left = count - top - bottom - right;
  const rowX = (n, i) => Math.trunc((240 - n * width - (n - 1) * 8) / 2) + i * (width + 8);
  const sideY = (n, i) => count === 3 ? 204 : n === 1 ? 150 : n === 2 ? 116 + i * 78 : 102 + i * 52;
  if (index < top) return {x: rowX(top, index), y: 50, width, height};
  index -= top;
  if (index < right) return {x: 236 - width, y: sideY(right, index), width, height};
  index -= right;
  if (index < bottom) return {x: rowX(bottom, bottom - 1 - index), y: 304 - height, width, height};
  index -= bottom;
  return {x: 4, y: sideY(left, left - 1 - index), width, height};
};
