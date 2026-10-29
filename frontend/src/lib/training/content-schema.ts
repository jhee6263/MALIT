// 훈련 콘텐츠의 핵심어·문법 목표·허용 표현 규칙.
// 관리자 편집 화면과 콘텐츠 API가 같은 규칙으로 입력을 검사하고 저장 형태를 만든다.

import { z } from "zod";

export const keywordRoles = ["subject", "location", "object", "verb"] as const;
export const grammarSlots = ["subject_particle", "location_particle", "object_particle", "verb_ending"] as const;
export type KeywordRole = (typeof keywordRoles)[number];
export type GrammarSlot = (typeof grammarSlots)[number];

export const keywordRoleLabels: Record<KeywordRole, string> = {
  subject: "주어",
  location: "장소",
  object: "목적어",
  verb: "동작",
};
export const grammarSlotLabels: Record<GrammarSlot, string> = {
  subject_particle: "주어 조사",
  location_particle: "장소 조사",
  object_particle: "목적어 조사",
  verb_ending: "동사 어미",
};
export const hintLabels = ["범주 단서", "의미 단서", "첫소리 단서"] as const;
// 문법 단계에서 처음 채워 주는 보기. 실제 보기는 편집 화면에서 바꿀 수 있다.
export const defaultGrammarChoices: Record<GrammarSlot, string[]> = {
  subject_particle: ["은", "는", "이", "가"],
  location_particle: ["에", "에서"],
  object_particle: ["을", "를"],
  verb_ending: ["아요", "어요", "해요"],
};

const text = (max: number) => z.string().trim().min(1).max(max);

export const keywordSchema = z.object({
  role: z.enum(keywordRoles),
  question: text(60),
  answer: text(30),
  // 범주 → 의미 → 첫소리 순서의 도움 단계. 기록 요약이 3단계를 기준으로 계산하므로 항상 3개를 둔다.
  hints: z.array(text(80)).length(3),
});
export const keywordsSchema = z.array(keywordSchema).max(keywordRoles.length).refine(
  (keywords) => new Set(keywords.map((keyword) => keyword.role)).size === keywords.length,
  { message: "같은 종류의 핵심어는 하나만 둘 수 있습니다." },
);

export const grammarInputSchema = z.object({
  slot: z.enum(grammarSlots),
  base: text(30),
  answer: text(20),
  completed: text(40),
  choices: z.array(text(20)).min(2).max(5),
}).refine((grammar) => grammar.choices.includes(grammar.answer), { message: "보기에 정답이 들어 있어야 합니다." })
  .refine((grammar) => new Set(grammar.choices).size === grammar.choices.length, { message: "같은 보기를 두 번 넣을 수 없습니다." });
export const grammarTargetsSchema = z.array(grammarInputSchema).max(8);

export const acceptedExpressionsSchema = z.array(text(120)).max(10);

export type KeywordInput = z.infer<typeof keywordSchema>;
export type GrammarInput = z.infer<typeof grammarInputSchema>;

/** 한글 음절의 마지막 글자에 받침이 있는지. 한글이 아니면 false */
export function hasFinalConsonant(char: string): boolean {
  const code = char.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/** 첫소리 단서 문구. 받침이 있으면 "이에요", 없으면 "예요"가 붙는다. */
export function firstSoundHint(word: string): string {
  const first = Array.from(word.trim())[0];
  if (!first) return "";
  return `첫소리는 '${first}'${hasFinalConsonant(first) ? "이에요" : "예요"}.`;
}

type StoredChoice = string | { value?: unknown; preview?: unknown };
type StoredGrammar = Record<string, unknown> & { choices?: StoredChoice[] };

/** 입력(보기 목록)을 훈련 화면이 쓰는 저장 형태로 바꾼다. 정답 보기는 완성형을, 나머지는 어간+보기를 미리보기로 갖는다. */
export function buildGrammarTarget(input: GrammarInput) {
  const verb = input.slot === "verb_ending";
  return {
    slot: input.slot,
    base: input.base,
    answer: input.answer,
    completed: input.completed,
    choices: input.choices.map((value) => ({ value, preview: value === input.answer ? input.completed : `${input.base}${value}` })),
    explanation: `${input.base} + ${input.answer} → ${input.completed}`,
    ...(verb ? { dictionaryForm: `${input.base}다` } : {}),
  };
}

/** 저장된 문법 목표를 편집 화면 입력 형태로 되돌린다. 예전 형식(stem, 문자열 보기)도 읽는다. */
export function toGrammarInput(stored: StoredGrammar): GrammarInput {
  const choices = (stored.choices ?? []).map((choice) => String(typeof choice === "string" ? choice : choice.value ?? "")).filter(Boolean);
  return {
    slot: stored.slot as GrammarSlot,
    base: String(stored.base ?? stored.stem ?? ""),
    answer: String(stored.answer ?? ""),
    completed: String(stored.completed ?? ""),
    choices,
  };
}

/** 목표 문장과 어긋나는 부분을 찾아 알려준다. 저장을 막지는 않고 검토할 때 참고한다. */
export function findContentWarnings(input: {
  targetSentence: string;
  acceptedExpressions: string[];
  keywords: Array<Pick<KeywordInput, "role" | "answer">>;
  grammarTargets: Array<Pick<GrammarInput, "slot" | "completed">>;
}): string[] {
  const squash = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, "");
  const sentence = squash(input.targetSentence);
  const warnings: string[] = [];
  for (const keyword of input.keywords) {
    if (keyword.answer && !sentence.includes(squash(keyword.answer))) {
      warnings.push(`${keywordRoleLabels[keyword.role]} 핵심어 "${keyword.answer}"이(가) 목표 문장에 없습니다.`);
    }
  }
  for (const grammar of input.grammarTargets) {
    if (grammar.completed && !sentence.includes(squash(grammar.completed))) {
      warnings.push(`${grammarSlotLabels[grammar.slot]} 완성형 "${grammar.completed}"이(가) 목표 문장에 없습니다.`);
    }
  }
  for (const expression of input.acceptedExpressions) {
    if (!expression.trim()) continue;
    if (squash(expression) !== sentence && !squash(expression).includes(sentence.slice(0, Math.max(2, Math.floor(sentence.length / 2))))) {
      warnings.push(`허용 표현 "${expression}"이(가) 목표 문장과 많이 다릅니다.`);
    }
  }
  return warnings;
}
