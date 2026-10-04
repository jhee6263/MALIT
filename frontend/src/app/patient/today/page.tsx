import { Footer } from "@/components/footer";
import { PatientHeader } from "@/components/patient-header";
import { TodayTrainingCard } from "@/components/patient/today-training-card";
import { createClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: { user } } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  const profileResult = user && supabase
    ? await supabase.from("profiles").select("name").eq("id", user.id).single()
    : { data: null };

  return (
    <div className="page-shell bg-[#f8f6f1]">
      <PatientHeader />
      <main className="container flex flex-1 items-center justify-center py-10">
        <section className="w-full max-w-[620px]">
          <h1 className="text-3xl font-bold sm:text-4xl">
            {profileResult.data?.name ? `${profileResult.data.name}님` : "오늘의 훈련"}
          </h1>
          <TodayTrainingCard />
        </section>
      </main>
      <Footer />
    </div>
  );
}
