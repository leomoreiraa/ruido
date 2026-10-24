import { Suspense } from "react";
import { PautaDetalheClient } from "@/components/PautaDetalheClient";

export const metadata = {
  title: "Detalhes da proposta | RUÍDO",
  description: "Votações, placares nominais e explicação de propostas legislativas com fontes oficiais.",
};

export default function PautaDetalhePage() {
  return <Suspense fallback={<p className="font-mono">Carregando proposta legislativa...</p>}>
    <PautaDetalheClient />
  </Suspense>;
}
