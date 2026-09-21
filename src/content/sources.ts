import type { ContentSource } from "./types";

/** 内置来源：当前所有内容均为项目原创 Mock。licenseType=unknown 不进 production 内容池。 */
export const MOCK_SOURCE: ContentSource = {
  id: "src-mock-original",
  name: "Project Mock Content (Original)",
  type: "mock",
  licenseType: "unknown",
  notes: "V10 阶段内置示例内容，非真题、非商业题库。",
};

export const CONTENT_SOURCES: Record<string, ContentSource> = {
  [MOCK_SOURCE.id]: MOCK_SOURCE,
};

export function getSource(id: string): ContentSource | undefined {
  return CONTENT_SOURCES[id];
}
