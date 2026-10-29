export type TrainingLevel = 1 | 2 | 3;
export type ContentStatus = "draft" | "review" | "published" | "archived";
export interface TrainingContent { id:string; title:string; level:TrainingLevel; topic:string; targetSentence:string; imagePath?:string|null; keywords:{ role:string; question:string; answer:string; hints:string[] }[]; grammar:{ stem:string; answer:string; choices:string[] }[]; status:ContentStatus; }
