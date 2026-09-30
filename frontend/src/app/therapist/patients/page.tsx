import Link from "next/link";
import { Settings2, UserRoundPlus, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/portal/empty-state";
import { createClient } from "@/lib/supabase/server";

export default async function PatientsPage() {
  const supabase = await createClient();
  const { data: { user } } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  const linksResult = user && supabase
    ? await supabase.from("therapist_patient_links").select("patient_id").eq("therapist_id", user.id)
    : { data: [] };
  const ids = (linksResult.data ?? []).map((link) => link.patient_id);
  const [profilesResult, settingsResult] = ids.length && supabase
    ? await Promise.all([
        supabase.from("profiles").select("id,name,login_id,birth_year,status,created_at").in("id", ids),
        supabase.from("learner_settings").select("patient_id,training_level,daily_count,topics").in("patient_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const settings = new Map((settingsResult.data ?? []).map((item) => [item.patient_id, item]));
  const patients = profilesResult.data ?? [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Patients</p>
          <h1 className="mt-2 text-3xl font-bold">환자 관리</h1>
          <p className="mt-2 text-[var(--muted)]">재활사가 직접 등록한 실제 환자만 표시합니다.</p>
        </div>
        <Link className="btn btn-primary" href="/therapist/patients/new"><UserRoundPlus size={19} /> 환자 등록</Link>
      </div>

      <section className="card mt-8 overflow-hidden">
        {patients.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="등록된 환자가 없습니다"
            description="계정 정보와 초기 훈련 설정을 정한 뒤 첫 환자를 등록하세요."
            action={<Link className="btn btn-primary" href="/therapist/patients/new">환자 등록</Link>}
          />
        ) : (
          <div className="table-wrap">
            <table className="patient-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>로그인 아이디</th>
                  <th>출생연도</th>
                  <th>훈련 단계</th>
                  <th>훈련 주제</th>
                  <th>하루 훈련량</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => {
                  const setting = settings.get(patient.id);
                  return (
                    <tr key={patient.id}>
                      <td className="font-bold">{patient.name}</td>
                      <td>{patient.login_id || "-"}</td>
                      <td>{patient.birth_year || "-"}</td>
                      <td>{setting ? `Level ${setting.training_level}` : "미설정"}</td>
                      <td className="patient-topics">
                        {setting?.topics?.length
                          ? setting.topics.map((topic: string, index: number) => (
                              <span className="patient-topic" key={topic}>
                                {topic}{index < setting.topics.length - 1 ? "," : ""}
                              </span>
                            ))
                          : "미설정"}
                      </td>
                      <td>{setting ? `${setting.daily_count}문장` : "미설정"}</td>
                      <td>{patient.status === "active" ? "활성" : patient.status}</td>
                      <td>
                        <Link className="btn btn-secondary min-h-10 px-3" href={`/therapist/patients/${patient.id}/settings`}>
                          <Settings2 size={17} /> 설정 변경
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
