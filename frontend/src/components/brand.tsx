import Link from "next/link";
import { MessageCircleMore } from "lucide-react";
export function Brand({compact=false}:{compact?:boolean}){return <Link href="/" className="inline-flex items-center gap-3" aria-label="말이음 홈"><span className="grid size-11 place-items-center rounded-[15px] bg-[var(--mint-700)] text-white"><MessageCircleMore size={25}/></span><span><strong className={compact?"text-xl":"text-2xl"}>말이음</strong>{!compact&&<small className="ml-2 text-sm font-bold tracking-[.16em] text-[var(--mint-700)]">MALIUM</small>}</span></Link>}
