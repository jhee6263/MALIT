export type UserRole = "patient" | "therapist" | "admin";
export type AccountStatus = "pending" | "active" | "rejected" | "suspended";
export type TrainingLevel = 1 | 2 | 3;
export type ContentStatus = "draft" | "review" | "published" | "archived";
export interface Patient { id:string; name:string; age:number; level:TrainingLevel; topics:string[]; dailyCount:number; lastTraining:string; weeklySessions:number; needsReview:boolean; }
export interface TrainingContent { id:string; title:string; level:TrainingLevel; topic:string; targetSentence:string; imagePath?:string|null; keywords:{ role:string; question:string; answer:string; hints:string[] }[]; grammar:{ stem:string; answer:string; choices:string[] }[]; status:ContentStatus; }
export interface AttemptRecord { contentId:string; step:string; target:string; hintLevel:number; success:boolean; source:"self"|"companion"|"therapist"|"demo"; createdAt:string; }
