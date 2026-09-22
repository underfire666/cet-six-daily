/**
 * V11 Profile 本地存储：targetScore + 提醒偏好 + 声音/震动/庆祝。
 * 只存用户偏好，不存学习记录（学习记录仍在 V2/V4–V9 各自 store）。
 * 未来 V12 接后端时，替换本文件的 LocalStorage 读写即可，UI 不动。
 */

export const PROFILE_KEY = "cet-daily:v1:profile";

export type TargetScore = 425 | 500 | 550 | 600;

export interface ReminderPrefs {
  evening: boolean;   // 20:00
  miss: boolean;     // 23:00
  lastChance: boolean; // 23:45
}

export interface SoundPrefs {
  answerSound: boolean;
  haptic: boolean;
  celebration: boolean;
}

export interface UserProfile {
  schemaVersion: 1;
  targetScore: TargetScore;
  reminders: ReminderPrefs;
  sound: SoundPrefs;
  createdAt: string;
  updatedAt: string;
}

export const defaultProfile = (): UserProfile => ({
  schemaVersion: 1,
  targetScore: 500,
  reminders: { evening: true, miss: true, lastChance: true },
  sound: { answerSound: true, haptic: true, celebration: true },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function loadProfile(storage: Storage | undefined): { profile: UserProfile; issue?: string } {
  if (!storage) return { profile: defaultProfile(), issue: "本地存储不可用" };
  let raw: string | null;
  try {
    raw = storage.getItem(PROFILE_KEY);
  } catch {
    return { profile: defaultProfile(), issue: "本地存储不可用" };
  }
  if (!raw) return { profile: defaultProfile() };
  try {
    const v = JSON.parse(raw);
    if (!isObj(v) || v.schemaVersion !== 1) return { profile: defaultProfile(), issue: "偏好版本不兼容，已重置" };
    const d = defaultProfile();
    const profile: UserProfile = {
      schemaVersion: 1,
      targetScore: [425, 500, 550, 600].includes(v.targetScore as number) ? (v.targetScore as TargetScore) : d.targetScore,
      reminders: { ...d.reminders, ...(isObj(v.reminders) ? v.reminders : {}) },
      sound: { ...d.sound, ...(isObj(v.sound) ? v.sound : {}) },
      createdAt: typeof v.createdAt === "string" ? v.createdAt : d.createdAt,
      updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : d.updatedAt,
    };
    return { profile };
  } catch {
    return { profile: defaultProfile(), issue: "偏好数据损坏，已重置" };
  }
}

export function saveProfile(storage: Storage | undefined, profile: UserProfile): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, updatedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}
