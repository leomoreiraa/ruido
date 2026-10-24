import Link from "next/link";
import { Volume2, ArrowUpRight } from "lucide-react";

/** Link global, estático e acessível; não inicia cobranças. */
export function RuidoSupportFloating() {
  return (
    <Link
      href="/apoie#pix"
      aria-label="Aumentar ruído — apoiar o projeto com Pix"
      className="ruido-support-fab"
    >
      <Volume2 size={19} strokeWidth={2.7} aria-hidden="true" />
      <span>AUMENTAR RUÍDO</span>
      <ArrowUpRight size={16} strokeWidth={2.7} aria-hidden="true" />
    </Link>
  );
}
