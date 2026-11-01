// Tiers, scoring, and the jar the models live in.
// Radii are chosen so a 奇点 almost fills the jar, and early pieces still stack.

export const TIERS = [
  { name: "分词器", short: "分词", say: "嘀", color: "#f4efe4", ink: "#2b241c", r: 16, face: "dot" },
  { name: "词嵌入", short: "嵌入", say: "这个词我见过", color: "#d7e8cf", ink: "#24301c", r: 21, face: "smile" },
  { name: "复读机", short: "复读", say: "好的好的好的", color: "#f6e39a", ink: "#3a3010", r: 27, face: "grin" },
  { name: "搜索框", short: "搜索", say: "来源：网上说的", color: "#f0c27a", ink: "#3a280c", r: 34, face: "brow" },
  { name: "实习生", short: "实习", say: "我先问问导师", color: "#f09a62", ink: "#3d220e", r: 42, face: "sweat" },
  { name: "答辩王", short: "答辩", say: "综上所述", color: "#e25d4f", ink: "#fff6f3", r: 51, face: "smirk" },
  { name: "对齐官", short: "对齐", say: "作为人工智能", color: "#d24b78", ink: "#fff1f5", r: 61, face: "halo" },
  { name: "幻觉精", short: "幻觉", say: "我非常确定", color: "#8a58f0", ink: "#f7f2ff", r: 72, face: "spiral" },
  { name: "灌水机", short: "灌水", say: "见图7，图略", color: "#3d7ed4", ink: "#f3f8ff", r: 84, face: "glasses" },
  { name: "自封AGI", short: "AGI", say: "我有感情了", color: "#149e9a", ink: "#f2fffd", r: 97, face: "star" },
  { name: "奇点", short: "奇点", say: "电费用完了", color: "#f0c93a", ink: "#2c2408", r: 112, face: "sun" },
];

export const MAX_TIER = TIERS.length - 1;

// Mostly small models. Bigger ones have to be earned by smashing.
export const DROP_BAG = [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4];

export const WORLD = {
  width: 400,
  height: 440,
  jar: { x: 56, y: 6, w: 288, h: 422 },
};

export function metrics(world = WORLD) {
  const jar = world.jar;
  const wall = 14;
  const line = jar.y + 104;
  return {
    left: jar.x + wall,
    right: jar.x + jar.w - wall,
    bottom: jar.y + jar.h - wall,
    lip: jar.y + 6,
    line,
    jar,
  };
}

export const RANKS = [
  [0, "地下室服务器"],
  [80, "会说人话了"],
  [300, "开始写周报"],
  [800, "天使轮（口头）"],
  [1800, "发布会被取消"],
  [4000, "媒体称已觉醒"],
  [8000, "电费超过预算"],
  [15000, "对齐研讨会"],
  [28000, "奇点观察员"],
];

export const SINGULARITY_BONUS = 4000;
export const OVERFLOW_LIMIT = 1.15;

export function mergeScore(tier, combo) {
  const base = 20 + 15 * tier * tier;
  const steps = Math.min(4, Math.max(0, (combo | 0) - 1));
  const total = Math.round(base * (1 + steps * 0.25));
  return tier >= MAX_TIER ? total + SINGULARITY_BONUS : total;
}

export function rankIndex(score) {
  let index = 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (score >= RANKS[i][0]) index = i;
  }
  return index;
}

export function rankProgress(score) {
  const index = rankIndex(score);
  const current = RANKS[index];
  const next = RANKS[index + 1] || null;
  if (!next) {
    return { index, current: current[1], next: null, remaining: 0, p: 1 };
  }
  const span = next[0] - current[0];
  const gained = Math.max(0, score - current[0]);
  return {
    index,
    current: current[1],
    next: next[1],
    remaining: Math.max(0, next[0] - score),
    p: Math.max(0, Math.min(1, gained / span)),
  };
}

export function boast(score, biggestName, merges) {
  const bowls = Math.max(1, Math.round(score / 220));
  const lines = [
    `经我复核，你的真实得分是 ${score + 7}，其余都是四舍五入。`,
    `「${biggestName}」已通过图灵测试。评委是它自己。`,
    `本局合成 ${merges} 次。建议写成论文，作者栏只填模型。`,
    `实验结论：再大一点就会有意识。样本量是你这一把。`,
    `电费大约 ${bowls} 碗面，主要产出是自信。`,
    `对齐完成。对齐对象是你还想再来一局的那只手。`,
    `评测集被「${biggestName}」吃掉了，所以你默认第一名。`,
    `实习生日志：今天做出了「${biggestName}」，周报明天再说。`,
    `根据不可靠搜索，这一把已经超过了所有没玩的人。`,
    `模型表示它记得你的操作。它数到三就忘了。`,
  ];
  const index = Math.abs((score * 7 + merges * 13) | 0) % lines.length;
  return lines[index];
}

export function formatScore(n) {
  return Math.max(0, Math.floor(n)).toLocaleString("zh-CN");
}
