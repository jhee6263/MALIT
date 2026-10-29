"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { KeyRound, PauseCircle, PlayCircle, ShieldCheck, Unlink, X } from "lucide-react";
import { DEFAULT_TEST_PASSWORD, PATIENT_PASSWORD_MIN_LENGTH } from "@/lib/auth/account-rules";

type Props = { patientId: string; name: string; loginId: string; status: string; locked: boolean };
type Action = "set_password" | "reset_password" | "suspend" | "resume" | "unlink";

export function AccountDialog({ patientId, name, loginId, status, locked }: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const suspended = status === "suspended";

  // 열 때마다 이전 입력과 메시지를 지운다.
  function open() {
    setPassword("");
    setError("");
    setNotice("");
    setConfirmUnlink(false);
    dialog.current?.showModal();
  }

  useEffect(() => {
    const element = dialog.current;
    const onClose = () => setBusy(null);
    element?.addEventListener("close", onClose);
    return () => element?.removeEventListener("close", onClose);
  }, []);

  async function run(action: Action, success: string) {
    if (busy) return;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/patients/${patientId}/account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "set_password" ? { action, password } : { action }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "처리하지 못했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      if (action === "unlink") {
        dialog.current?.close();
      } else {
        setNotice(success);
        if (action === "set_password") setPassword("");
      }
      router.refresh();
    } catch {
      setError("처리하지 못했습니다. 네트워크를 확인해주세요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary min-h-10 px-3" onClick={open}><ShieldCheck size={17} /> 계정 관리</button>
      <dialog ref={dialog} className="m-auto w-[min(92vw,34rem)] rounded-3xl border border-[var(--line)] p-0 shadow-2xl backdrop:bg-black/40" aria-labelledby={`account-title-${patientId}`}>
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={`account-title-${patientId}`} className="text-xl font-bold">{name}님 계정 관리</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">로그인 아이디 {loginId || "-"} · {suspended ? "이용 정지됨" : "이용 중"}</p>
            </div>
            <button type="button" aria-label="닫기" className="rounded-full p-2 hover:bg-[#f1f5f3]" onClick={() => dialog.current?.close()}><X size={20} /></button>
          </div>

          {locked ? (
            <p className="mt-5 rounded-xl bg-[#fff7ec] p-4 text-sm font-bold leading-6 text-[#8a5a2d]">로그인 화면에 공개된 확인용 계정은 비밀번호 변경, 정지, 연결 해제를 할 수 없습니다.</p>
          ) : (
            <div className="mt-5 grid gap-6">
              {error && <p role="alert" className="rounded-xl bg-[#fff3f3] p-3 text-sm font-bold text-[var(--danger)]">{error}</p>}
              {notice && <p role="status" className="rounded-xl bg-[var(--mint-50)] p-3 text-sm font-bold text-[var(--mint-700)]">{notice}</p>}

              <section>
                <h3 className="flex items-center gap-2 font-bold"><KeyRound size={18} /> 비밀번호</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">환자는 직접 비밀번호를 바꿀 수 없습니다. 새 비밀번호를 정해 환자나 보호자에게 알려주세요.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input className="field min-w-0 flex-1" type="text" autoComplete="off" placeholder={`새 비밀번호 (${PATIENT_PASSWORD_MIN_LENGTH}자 이상)`} value={password} disabled={suspended} onChange={(event) => setPassword(event.target.value)} />
                  <button type="button" className="btn btn-primary min-h-[54px]" disabled={suspended || busy !== null || password.length < PATIENT_PASSWORD_MIN_LENGTH} onClick={() => run("set_password", "새 비밀번호로 바꿨어요. 환자에게 알려주세요.")}>{busy === "set_password" ? "변경 중…" : "변경"}</button>
                </div>
                <button type="button" className="mt-2 text-sm font-bold text-[var(--mint-700)] underline disabled:opacity-50" disabled={suspended || busy !== null} onClick={() => run("reset_password", `초기 비밀번호(${DEFAULT_TEST_PASSWORD})로 되돌렸어요.`)}>{busy === "reset_password" ? "되돌리는 중…" : `초기 비밀번호(${DEFAULT_TEST_PASSWORD})로 되돌리기`}</button>
              </section>

              <section>
                <h3 className="flex items-center gap-2 font-bold">{suspended ? <PlayCircle size={18} /> : <PauseCircle size={18} />} 이용 상태</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{suspended ? "정지된 계정은 로그인할 수 없습니다. 다시 사용하면 바로 로그인할 수 있어요." : "정지하면 환자가 로그인할 수 없고 이미 열린 화면도 다음 요청부터 막힙니다. 훈련 기록은 그대로 남습니다."}</p>
                <button type="button" className={`btn mt-3 min-h-11 ${suspended ? "btn-primary" : "btn-secondary"}`} disabled={busy !== null} onClick={() => run(suspended ? "resume" : "suspend", suspended ? "다시 사용할 수 있게 했어요." : "계정을 정지했어요.")}>{suspended ? <><PlayCircle size={18} /> 다시 사용하기</> : <><PauseCircle size={18} /> 계정 정지</>}</button>
              </section>

              <section className="rounded-2xl border border-[#eccaca] bg-[#fff9f9] p-4">
                <h3 className="flex items-center gap-2 font-bold text-[var(--danger)]"><Unlink size={18} /> 담당 해제</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">해제하면 이 환자가 내 목록에서 사라지고 훈련 기록도 볼 수 없습니다. 환자 계정과 기록은 삭제되지 않으며, 다시 연결하려면 관리자에게 요청해야 합니다.</p>
                <label className="mt-3 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={confirmUnlink} onChange={(event) => setConfirmUnlink(event.target.checked)} /> 위 내용을 확인했어요</label>
                <button type="button" className="btn btn-danger mt-3 min-h-11" disabled={!confirmUnlink || busy !== null} onClick={() => run("unlink", "")}>{busy === "unlink" ? "해제 중…" : "담당 해제"}</button>
              </section>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
