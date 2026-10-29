import Link from "next/link";
import { Brand } from "./brand";
import { LogoutButton } from "./logout-button";

export function PatientHeader({
  step,
  currentStep,
  totalSteps = 5,
  training = false,
}: {
  step?: string;
  currentStep?: number;
  totalSteps?: number;
  training?: boolean;
}) {
  return (
    <header className="border-b border-[#ddd8cf] bg-white">
      <div className="container grid min-h-[72px] grid-cols-[1fr_auto_1fr] items-center gap-4">
        <Brand compact />
        <div className="text-center">
          {step && <div className="text-xs font-bold text-[#56645f]">{step}</div>}
          {currentStep && (
            <div className="mt-2 flex justify-center gap-1">
              {Array.from({ length: totalSteps }, (_, index) => (
                <span
                  key={index}
                  className={`h-1 w-7 rounded-full ${index < currentStep ? "bg-[#2e9b86]" : "bg-[#d8d4ca]"}`}
                />
              ))}
            </div>
          )}
        </div>
        {training ? (
          <Link href="/patient/today" className="ml-auto rounded-xl border border-[#d8d1c5] px-4 py-2 text-sm font-bold text-[#5f6764]">
            잠시 쉬기
          </Link>
        ) : (
          <LogoutButton className="ml-auto inline-flex items-center gap-2 text-sm font-bold text-[#67736f]" label="나가기" />
        )}
      </div>
    </header>
  );
}
