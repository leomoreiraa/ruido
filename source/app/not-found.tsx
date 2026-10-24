import Link from "next/link";
import { ArrowLeft, ArrowUpRight, RadioTower } from "lucide-react";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <section className={styles.wall} aria-labelledby="ruido-404-title">
      <div className={styles.topline}>
        <span>RUÍDO / ARQUIVO PÚBLICO / FREQUÊNCIA 404</span>
        <span className={styles.emergency}>● TRANSMISSÃO INTERROMPIDA</span>
      </div>

      <div className={styles.grid}>
        <div className={styles.art} aria-hidden="true">
          <div className={styles.halo} />
          <span className={styles.crossA}>×</span>
          <span className={styles.crossB}>×</span>
          <div className={styles.numeral}>
            <span>4</span><span>0</span><span>4</span>
          </div>
          <svg className={styles.static} viewBox="0 0 460 145" fill="none" aria-hidden="true">
            <path d="M2 72h55l15-42 22 87 23-56 22 24 26-61 28 96 27-56 18 18 12-35 18 25h48l12-55 28 104 20-57 17 14h54"
              stroke="#d3ff20" strokeWidth="8" strokeLinecap="square" strokeLinejoin="miter" />
            <path d="M2 90h458M2 35h458M2 121h458" stroke="#f7f1e5" strokeWidth="2" strokeDasharray="13 19" />
          </svg>
          <span className={styles.stamp}>SINAL NÃO ENCONTRADO</span>
        </div>

        <div className={styles.copy}>
          <span className={styles.mini}><RadioTower size={14} aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />ALERTA / ENDEREÇO FORA DO AR</span>
          <h1 id="ruido-404-title" className={styles.heading}>
            FREQUÊNCIA <strong>PERDIDA.</strong>
          </h1>
          <p className={styles.caption}>
            Este endereço não faz parte dos registros publicados. O link pode ter mudado,
            ou a página pode não existir. Os dados continuam por aqui — só precisamos
            encontrar o caminho certo.
          </p>
          <nav className={styles.buttons} aria-label="Sair do erro 404">
            <Link href="/" className={styles.primary}><ArrowLeft size={17} aria-hidden="true" /> VOLTAR AO RUÍDO</Link>
            <Link href="/parlamentares" className={styles.secondary}>INVESTIGAR PERFIS <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </nav>
        </div>
      </div>
      <div className={styles.bottom}>
        <span>ERRO 404 / NENHUM DADO INVENTADO</span>
        <span>O SILÊNCIO TAMBÉM É UM SINAL. /// RUÍDO</span>
      </div>
    </section>
  );
}
