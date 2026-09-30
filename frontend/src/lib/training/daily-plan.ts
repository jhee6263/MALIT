import type { TrainingContent, TrainingLevel } from "@/lib/types";

type PlanInput = {
  level: TrainingLevel;
  topics: string[];
  excludedTopics: string[];
  dailyCount: number;
  recentContentIds: string[];
};

export function buildD1DailyPlan(contents: TrainingContent[], input: PlanInput) {
  const recentOrder = new Map<string, number>();
  input.recentContentIds.forEach((id, index) => {
    if (!recentOrder.has(id)) recentOrder.set(id, index);
  });

  const candidates = contents.filter(
    (content) =>
      content.status === "published" &&
      content.level === input.level &&
      input.topics.includes(content.topic) &&
      !input.excludedTopics.includes(content.topic),
  );
  const byTopicAndTitle = (a: TrainingContent, b: TrainingContent) =>
    a.topic.localeCompare(b.topic, "ko") || a.title.localeCompare(b.title, "ko");
  const fresh = candidates.filter((content) => !recentOrder.has(content.id)).sort(byTopicAndTitle);
  const review = candidates
    .filter((content) => recentOrder.has(content.id))
    .sort((a, b) => {
      const oldestFirst = (recentOrder.get(b.id) ?? 0) - (recentOrder.get(a.id) ?? 0);
      return oldestFirst || byTopicAndTitle(a, b);
    });

  return [...fresh, ...review].slice(0, input.dailyCount).map((content, index) => ({
    content,
    itemType: recentOrder.has(content.id) ? "review" as const : "new" as const,
    order: index + 1,
    reason: recentOrder.has(content.id) ? "이전에 연습한 문장 복습" : "선택한 주제의 새 문장",
  }));
}
