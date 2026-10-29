"use client";

// 브라우저 내장 음성인식(Web Speech API) 훅.
// 인식 결과는 사람이 확인할 때 참고하는 보조 정보이며, 이 훅은 맞고 틀림을 판단하지 않는다.
// 말소리는 브라우저 제공사 서버로 전송되고 말이음은 음성 파일을 저장하지 않는다.
// 이 훅과 같은 모양(supported · status · transcript …)을 돌려주는 다른 엔진으로 바꿔 끼울 수 있게 훈련 화면은 이 훅만 사용한다.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type RecognitionAlternative = { transcript: string; confidence: number };
type RecognitionResult = { isFinal: boolean; length: number; [index: number]: RecognitionAlternative };
type RecognitionEvent = { results: { length: number; [index: number]: RecognitionResult } };
type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onspeechstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionConstructor = new () => RecognitionInstance;

export type SpeechStatus = "idle" | "listening" | "finished";

// 말을 시작한 뒤 이 시간 동안 새 말이 없으면 다 말한 것으로 본다. 실어증 환자는 말 사이가 길 수 있어 넉넉하게 잡는다.
const SILENCE_AFTER_SPEECH_MS = 3500;
const MAX_LISTEN_MS = 30_000;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const subscribeNothing = () => () => {};

export function useSpeechRecognition({ waitSeconds }: { waitSeconds: number }) {
  // 서버 렌더링에서는 항상 false로 시작해 화면이 어긋나지 않게 한다.
  const supported = useSyncExternalStore(subscribeNothing, () => getRecognitionConstructor() !== null, () => false);
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [firstSpeechMs, setFirstSpeechMs] = useState<number | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const startedAt = useRef(0);
  const firstSpeechRef = useRef<number | null>(null);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    for (const timer of [waitTimer, silenceTimer, capTimer]) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const discard = useCallback(() => {
    clearTimers();
    const current = recognitionRef.current;
    recognitionRef.current = null;
    current?.abort();
  }, [clearTimers]);

  const reset = useCallback(() => {
    discard();
    firstSpeechRef.current = null;
    setStatus("idle");
    setTranscript("");
    setConfidence(null);
    setFirstSpeechMs(null);
    setErrorCode(null);
  }, [discard]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) return;
    discard();
    firstSpeechRef.current = null;
    setTranscript("");
    setConfidence(null);
    setFirstSpeechMs(null);
    setErrorCode(null);

    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    startedAt.current = Date.now();

    const markFirstSpeech = () => {
      if (firstSpeechRef.current !== null) return;
      firstSpeechRef.current = Date.now() - startedAt.current;
      setFirstSpeechMs(firstSpeechRef.current);
    };

    recognition.onspeechstart = () => {
      if (recognitionRef.current === recognition) markFirstSpeech();
    };
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const parts: string[] = [];
      const confidences: number[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result[0];
        if (!alternative) continue;
        parts.push(alternative.transcript);
        // 브라우저가 신뢰도를 주지 않으면 0이 오므로 값이 있는 것만 평균에 쓴다.
        if (result.isFinal && alternative.confidence > 0) confidences.push(alternative.confidence);
      }
      const text = parts.join(" ").trim();
      setTranscript(text);
      setConfidence(confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null);
      if (!text) return;
      markFirstSpeech();
      if (waitTimer.current) clearTimeout(waitTimer.current);
      waitTimer.current = null;
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => recognition.stop(), SILENCE_AFTER_SPEECH_MS);
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      // 말이 없었던 경우와 직접 멈춘 경우는 오류로 보지 않는다.
      if (event.error !== "no-speech" && event.error !== "aborted") setErrorCode(event.error);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      clearTimers();
      recognitionRef.current = null;
      setStatus("finished");
    };

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setErrorCode("start-failed");
      setStatus("finished");
      return;
    }
    setStatus("listening");
    // 말을 시작하기까지 환자별 대기 시간만큼 기다린 뒤에도 말이 없으면 멈춘다.
    waitTimer.current = setTimeout(() => recognition.stop(), Math.max(waitSeconds, 3) * 1000);
    capTimer.current = setTimeout(() => recognition.stop(), MAX_LISTEN_MS);
  }, [clearTimers, discard, waitSeconds]);

  useEffect(() => discard, [discard]);

  return { supported, status, transcript, confidence, firstSpeechMs, errorCode, start, stop, reset };
}
