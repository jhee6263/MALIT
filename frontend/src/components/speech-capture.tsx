"use client";

import { Check, HelpCircle, Mic, RotateCcw, UsersRound } from "lucide-react";
import type { useSpeechRecognition } from "@/lib/speech/use-speech-recognition";
import { compareSpeech, type SpeechRecord } from "@/lib/training/speech-match";

type Speech = ReturnType<typeof useSpeechRecognition>;

const errorMessages: Record<string, string> = {
  "not-allowed": "마이크 사용이 허용되지 않았어요. 주소창의 마이크 설정을 확인해주세요.",
  "service-not-allowed": "이 브라우저에서는 음성인식을 쓸 수 없어요.",
  "audio-capture": "마이크를 찾지 못했어요.",
  network: "인터넷 연결을 확인해주세요.",
};

/**
 * 마이크로 말한 내용을 글자로 보여주는 보조 화면.
 * 인식 결과로 성공·실패를 정하지 않는다. 결과는 모두 사람이 버튼으로 확인한다.
 */
export function SpeechCapture({
  speech,
  targets,
  variant,
  disabled,
  canHelp,
  onSave,
  onManual,
  onOtherPerson,
  onHelp,
}: {
  speech: Speech;
  /** 비교할 목표 표현 (핵심어 답, 또는 목표 문장과 허용 표현) */
  targets: string[];
  variant: "keyword" | "sentence";
  disabled: boolean;
  canHelp: boolean;
  /** 이렇게 들었어요 화면에서 사람이 판정한 경우. 바로 기록한다. */
  onSave: (success: boolean, record: SpeechRecord) => void;
  /** 직접 확인 화면으로 넘어간다 */
  onManual: (record: SpeechRecord) => void;
  onOtherPerson: (record: SpeechRecord) => void;
  onHelp: () => void;
}) {
  const buildRecord = (extra: Partial<SpeechRecord> = {}): SpeechRecord => {
    const match = compareSpeech(speech.transcript, targets, speech.confidence);
    return {
      engine: "web-speech",
      transcript: speech.transcript,
      confidence: speech.confidence,
      match: match.level,
      similarity: match.similarity,
      closest: match.closest,
      firstSpeechMs: speech.firstSpeechMs,
      error: speech.errorCode,
      ...extra,
    };
  };

  if (speech.status === "idle") {
    return variant === "keyword" ? (
      <>
        <button className="mx-auto mt-8 flex size-28 items-center justify-center rounded-full bg-[#2c9a83] text-white shadow-sm" aria-label="말하기 시작" disabled={disabled} onClick={speech.start}><Mic size={43} /></button>
        <p className="mt-3 text-center font-bold">눌러서 말해보세요</p>
      </>
    ) : (
      <button className="btn btn-primary mt-9 w-full" disabled={disabled} onClick={speech.start}><Mic size={20} /> 눌러서 문장을 말해보세요</button>
    );
  }

  if (speech.status === "listening") {
    return (
      <div className="mt-7 rounded-2xl border border-[#c9d9d2] bg-[#f4faf7] p-6 text-center" role="status" aria-live="polite">
        <span className="mx-auto flex size-20 animate-pulse items-center justify-center rounded-full bg-[#2c9a83] text-white"><Mic size={34} /></span>
        <p className="mt-4 break-keep text-xl font-bold">듣고 있어요. 천천히 말씀하세요.</p>
        <p className="mt-3 min-h-8 break-keep text-lg text-[var(--muted)]">{speech.transcript}</p>
        <button className="btn btn-primary mt-4 min-h-14 w-full" onClick={speech.stop}><Check size={20} /> 다 말했어요</button>
      </div>
    );
  }

  const heardText = speech.transcript.trim();
  const match = compareSpeech(speech.transcript, targets, speech.confidence);
  const hard = !heardText || match.level === "unclear" || speech.errorCode !== null;

  if (hard) {
    const reason = speech.errorCode ? errorMessages[speech.errorCode] : undefined;
    return (
      <div className="mt-7 rounded-2xl border border-[#e3d3b4] bg-[#fffaf0] p-5 text-center">
        <p className="break-keep text-xl font-bold">말을 정확히 확인하기 어려워요</p>
        <p className="mt-2 break-keep text-sm text-[var(--muted)]">{reason ?? "잘 들리지 않았어요. 다시 말하거나, 말한 내용을 사람이 확인할 수 있어요."}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="btn btn-primary min-h-14" disabled={disabled} onClick={speech.start}><RotateCcw size={19} /> 다시 말할게요</button>
          <button className="btn btn-secondary min-h-14" disabled={disabled} onClick={() => onManual(buildRecord({ unclear: true }))}><Check size={19} /> 말했어요</button>
          <button className="btn btn-secondary min-h-14" disabled={disabled} onClick={() => onOtherPerson(buildRecord({ unclear: true }))}><UsersRound size={19} /> 다른 사람이 확인</button>
          <button className="btn btn-secondary min-h-14" disabled={disabled || !canHelp} onClick={onHelp}><HelpCircle size={19} /> 도움이 필요해요</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-7 rounded-2xl border border-[#c9d9d2] bg-[#f4faf7] p-5 text-center">
      <p className="text-sm font-bold text-[var(--mint-700)]">이렇게 들었어요</p>
      <p className="mt-2 break-keep text-2xl font-bold">“{heardText}”</p>
      <p className="mt-3 break-keep text-sm text-[var(--muted)]">소리를 글자로 바꾼 참고용 결과예요. 잘 말했는지는 사람이 확인해요.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <button className={`btn min-h-14 ${match.level === "match" ? "btn-secondary" : "btn-primary"}`} disabled={disabled} onClick={() => onSave(false, buildRecord())}><RotateCcw size={19} /> 다시 말할게요</button>
        <button className="btn btn-secondary min-h-14" disabled={disabled} onClick={() => onManual(buildRecord({ disputed: true }))}>앱이 잘 못 들었어요</button>
        <button className={`btn min-h-14 ${match.level === "match" ? "btn-primary" : "btn-secondary"}`} disabled={disabled} onClick={() => onSave(true, buildRecord())}><Check size={20} /> {disabled ? "저장 중…" : "잘 말했어요"}</button>
      </div>
    </div>
  );
}
