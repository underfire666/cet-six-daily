import { hashString } from "./normalize";

/** 确定性伪随机：同一 seed 永远同一序列。 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SelectOptions<T> {
  /** 过滤后候选池（已在模块内筛好）。 */
  pool: T[];
  limit: number;
  /** 确定性种子，例如 `${date}:${module}:${userId}`。 */
  seed: string;
  /** 排除最近做过的 ID。 */
  excludeIds?: Set<string>;
  /** 取 id 字段。 */
  idOf: (item: T) => string;
  /** 候选不足时是否允许重复练习。 */
  allowRepeat?: boolean;
}

export interface SelectResult<T> {
  items: T[];
  fallbackReason?: "pool_small" | "all_excluded";
}

/**
 * 确定性选择：同一 seed + 同一 pool 永远返回同序结果。
 * excludeIds 命中后从剩余里选；若剩余不足 limit，按 allowRepeat 决定是否回填。
 */
export function selectContent<T>(opts: SelectOptions<T>): SelectResult<T> {
  const { pool, limit, seed, excludeIds, idOf, allowRepeat = false } = opts;
  const rng = mulberry32(hashString(seed));

  // 复制后用确定性 RNG 洗牌
  const shuffled = [...pool].sort(() => rng() - 0.5);

  const fresh = excludeIds ? shuffled.filter((x) => !excludeIds.has(idOf(x))) : shuffled;
  const out = fresh.slice(0, limit);

  let fallbackReason: SelectResult<T>["fallbackReason"];
  if (out.length < limit) {
    if (fresh.length === 0 && excludeIds && pool.length > 0) {
      if (allowRepeat) {
        out.push(...shuffled.filter((x) => !out.includes(x)).slice(0, limit - out.length));
        fallbackReason = "all_excluded";
      }
    } else {
      fallbackReason = "pool_small";
    }
  }
  return { items: out, fallbackReason };
}
