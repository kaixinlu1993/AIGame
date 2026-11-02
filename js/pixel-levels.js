function grid(width, height) {
  return Array.from({ length: height }, () => Array(width).fill("."));
}

function paint(rows, x, y, text) {
  for (let i = 0; i < text.length; i += 1) rows[y][x + i] = text[i];
}

function fillGround(rows, x, y, length) {
  for (let dy = 0; dy < 3; dy += 1) paint(rows, x, y + dy, "#".repeat(length));
}

function finish(rows) {
  return rows.map((row) => row.join(""));
}

function levelOne() {
  const rows = grid(56, 10);
  const ground = 6;
  fillGround(rows, 0, ground, 12);
  fillGround(rows, 15, ground, 10);
  fillGround(rows, 28, ground, 10);
  fillGround(rows, 41, ground, 15);
  paint(rows, 2, ground - 1, "P");
  paint(rows, 8, ground - 2, "o");
  paint(rows, 18, ground - 3, "o");
  paint(rows, 32, ground - 2, "o");
  paint(rows, 48, ground - 2, "o");
  paint(rows, 50, ground - 1, "F");
  return finish(rows);
}

function levelTwo() {
  const rows = grid(64, 10);
  const ground = 6;
  fillGround(rows, 0, ground, 12);
  paint(rows, 12, ground, "^^^");
  fillGround(rows, 15, ground, 18);
  fillGround(rows, 36, ground, 28);
  paint(rows, 2, ground - 1, "P");
  paint(rows, 8, ground - 2, "o");
  paint(rows, 24, ground - 1, "E");
  paint(rows, 20, ground - 3, "o");
  paint(rows, 44, ground - 2, "o");
  paint(rows, 58, ground - 1, "F");
  return finish(rows);
}

function levelThree() {
  const rows = grid(72, 13);
  const ground = 9;
  fillGround(rows, 0, ground, 10);
  paint(rows, 10, ground, "M");
  fillGround(rows, 22, ground, 16);
  paint(rows, 38, ground, "^^^");
  fillGround(rows, 41, ground, 8);
  for (let step = 0; step < 6; step += 1) {
    const top = ground - (step + 1);
    for (let y = top; y < rows.length; y += 1) paint(rows, 49 + step, y, "#");
  }
  paint(rows, 2, ground - 1, "P");
  paint(rows, 14, ground - 3, "o");
  paint(rows, 28, ground - 1, "E");
  paint(rows, 46, ground - 2, "o");
  paint(rows, 54, ground - 7, "F");
  return finish(rows);
}

export const LEVELS = [
  {
    name: "出门",
    hint: "看到空了就跳。",
    clear: "这关过了。",
    rows: levelOne(),
  },
  {
    name: "刺和虫子",
    hint: "刺要跳过去，虫子可以从头上踩。",
    clear: "刺和虫子都躲开了。",
    rows: levelTwo(),
  },
  {
    name: "会动的地板",
    hint: "站上移动的地板，等它靠岸再下去。",
    clear: "送到了。",
    rows: levelThree(),
  },
];
