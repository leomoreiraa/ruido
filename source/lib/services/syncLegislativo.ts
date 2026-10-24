// lib/services/syncLegislativo.ts

import { prisma } from "@/lib/prisma";
import {
  ParametrosSincronizacao,
  RelatorioSincronizacao,
  StatusSync,
} from "@/lib/types";
import {
  sincronizarDeputadosAtuaisCamara,
  sincronizarPresencasCamara,
  sincronizarVotacoesCamara,
} from "./syncCamaraService";
import { acquireSyncLease, SyncLockError } from "./syncLock";
import {
  sincronizarSenadoresAtuais,
  sincronizarVotacoesEPresencasSenado,
} from "./syncSenadoService";

// Exportações retrocompatíveis para chamadas existentes do backend
export { normalizarVotoCamara } from "./camaraNormalizer";
export { normalizarVotoSenado } from "./senadoNormalizer";
export {
  sincronizarDeputadosAtuaisCamara as sincronizarParlamentaresCamara,
  sincronizarPresencasCamara,
  sincronizarVotacoesCamara,
} from "./syncCamaraService";
export { acquireSyncLease, SyncLockError } from "./syncLock";
// Alias para manter compatibilidade com módulos anteriores
export { SyncLockError as SyncEmAndamentoError } from "./syncLock";
export {
  sincronizarSenadoresAtuais as sincronizarParlamentaresSenado,
  sincronizarVotacoesEPresencasSenado,
} from "./syncSenadoService";


export type { ParametrosSincronizacao, RelatorioSincronizacao };

/**
 * Calcula intervalo padrão em timezone brasileiro (America/Sao_Paulo).
 */
export function calcularPeriodoPadrao(diasRetroativos = 5): {
  dataInicio: string;
  dataFim: string;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const hoje = new Date();
  const dataFim = formatter.format(hoje);

  const passado = new Date(hoje);
  passado.setDate(hoje.getDate() - diasRetroativos);
  const dataInicio = formatter.format(passado);

  return { dataInicio, dataFim };
}

/**
 * Orquestrador principal de sincronização com lease lock em banco e registro de auditoria.
 *
 * Suporta assinatura polimórfica:
 * - executarSincronizacaoCompleta(dias?: number)
 * - executarSincronizacaoCompleta(parametros: ParametrosSincronizacao)
 *
 * Garante:
 * 1. Lease lock contra concorrência;
 * 2. Registro de SyncExecution com status EM_ANDAMENTO, SUCESSO ou ERRO;
 * 3. Falha explícita se APIs falharem (sem mascarar erros);
 * 4. Nenhuma mutação de ausência inventada;
 * 5. Bounded transactions sem fetch de rede interna.
 */
export async function executarSincronizacaoCompleta(
  paramsOuDias?: number | ParametrosSincronizacao
): Promise<RelatorioSincronizacao> {
  const params: ParametrosSincronizacao =
    typeof paramsOuDias === "number"
      ? calcularPeriodoPadrao(paramsOuDias)
      : paramsOuDias && typeof paramsOuDias === "object"
      ? paramsOuDias
      : calcularPeriodoPadrao(5);

  const iniciadoEm = new Date().toISOString();

  // 1. Adquire Lease Lock no Banco de Dados
  const lease = await acquireSyncLease("GLOBAL_SYNC", 180_000);

  // 2. Cria registro inicial de execução
  const execucao = await prisma.syncExecution.create({
    data: {
      iniciadoEm: new Date(iniciadoEm),
      status: StatusSync.EM_ANDAMENTO,
      parametros: JSON.stringify(params),
    },
  });

  try {
    console.log(
      `[Sync] Iniciando sincronização (${params.dataInicio} até ${params.dataFim})...`
    );

    // 1. Roster Oficial Atual (Deputados e Senadores)
    console.log("-> 1. Sincronizando Parlamentares Atuais...");
    const [deputadosCount, senadoresCount] = await Promise.all([
      sincronizarDeputadosAtuaisCamara(),
      sincronizarSenadoresAtuais(),
    ]);
    console.log(
      `   Câmara: ${deputadosCount} deputados | Senado: ${senadoresCount} senadores.`
    );

    // 2. Votações da Câmara
    console.log("-> 2. Sincronizando Votações da Câmara...");
    const camaraVotacoesRes = await sincronizarVotacoesCamara({
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      limite: params.limiteVotacoesCamara ?? 40,
    });
    console.log(
      `   Câmara: ${camaraVotacoesRes.votacoesSincronizadas} votações, ${camaraVotacoesRes.votosSincronizados} votos.`
    );

    // 3. Presenças em Sessões Plenárias da Câmara (Positive Evidence Only)
    console.log("-> 3. Sincronizando Presenças da Câmara...");
    const camaraPresencasCount = await sincronizarPresencasCamara({
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      limiteSessoes: params.limiteEventosCamara ?? 15,
    });
    console.log(`   Câmara: ${camaraPresencasCount} registros de presença.`);

    // 4. Votações e Presenças do Senado (/votacao?dataInicio=...&dataFim=...)
    console.log("-> 4. Sincronizando Votações e Presenças do Senado...");
    const senadoRes = await sincronizarVotacoesEPresencasSenado(
      params.dataInicio,
      params.dataFim
    );
    console.log(
      `   Senado: ${senadoRes.votacoesSincronizadas} votações, ${senadoRes.votosSincronizados} votos, ${senadoRes.presencasSincronizadas} presenças.`
    );

    const relatorio: RelatorioSincronizacao = {
      iniciadoEm,
      finalizadoEm: new Date().toISOString(),
      periodo: {
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
      },
      camara: {
        parlamentares: deputadosCount,
        votacoes: camaraVotacoesRes.votacoesSincronizadas,
        votos: camaraVotacoesRes.votosSincronizados,
        presencas: camaraPresencasCount,
      },
      senado: {
        parlamentares: senadoresCount,
        votacoes: senadoRes.votacoesSincronizadas,
        votos: senadoRes.votosSincronizados,
        presencas: senadoRes.presencasSincronizadas,
      },
    };

    // 3. Registra sucesso na execução
    await prisma.syncExecution.update({
      where: { id: execucao.id },
      data: {
        finalizadoEm: new Date(relatorio.finalizadoEm),
        status: StatusSync.SUCESSO,
        resumo: JSON.stringify(relatorio),
      },
    });

    return relatorio;
  } catch (err) {
    const mensagemErro = err instanceof Error ? err.stack || err.message : String(err);
    console.error("[Sync] Erro durante a execução da sincronização:", mensagemErro);

    // Registra falha na execução
    await prisma.syncExecution.update({
      where: { id: execucao.id },
      data: {
        finalizadoEm: new Date(),
        status: StatusSync.ERRO,
        erro: mensagemErro,
      },
    }).catch((dbErr) => {
      console.warn("[Sync] Falha ao atualizar status de erro da execução:", dbErr);
    });

    throw err;
  } finally {
    await lease.release();
  }
}
