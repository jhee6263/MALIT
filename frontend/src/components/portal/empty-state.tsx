import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return <div className="p-10 text-center sm:p-14"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--mint-50)] text-[var(--mint-700)]"><Icon size={28} /></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mx-auto mt-2 max-w-xl break-keep leading-7 text-[var(--muted)]">{description}</p>{action && <div className="mt-6">{action}</div>}</div>;
}
