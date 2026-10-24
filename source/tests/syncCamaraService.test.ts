import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { camaraApiClient, FatalHttpError } from "../lib/services/apiClient";
import { sincronizarPresencasCamara, sincronizarVotacoesCamara } from "../lib/services/syncCamaraService";

const base = "https://dadosabertos.camara.leg.br/api/v2";
const votacao = { id: "1-1", data: "2026-01-01", descricao: "Teste" };
const evento = { id: 1, dataHoraInicio: "2026-01-01T12:00:00" };
const deputado = { id: 1, nome: "Teste" };

for (const target of ["detail", "votes-first", "votes-next", "attendance-first", "attendance-next"] as const) {
  for (const failure of ["404", "null"] as const) {
    test(`${target}: ${failure} rejects instead of committing empty/partial data`, async t => {
      
      const transaction = t.mock.method(prisma, "$transaction", async () => {
        throw new Error("Unexpected database transaction");
      });
      const requested: string[] = [];
      t.mock.method(camaraApiClient, "fetchJson", async (path: string, options?: { acceptStatuses?: number[] }) => {
        const url = new URL(path.startsWith("http") ? path : `${base}${path}`);
        requested.push(url.pathname + url.search);
        const isDetail = url.pathname === "/api/v2/votacoes/1-1";
        const isVotes = url.pathname.endsWith("/votos");
        const isAttendance = url.pathname.endsWith("/deputados");
        const isNext = url.searchParams.get("pagina") === "2";
        const shouldFail = target === "detail" ? isDetail
          : target.startsWith("votes") ? isVotes && (target.endsWith("next") ? isNext : !isNext)
          : isAttendance && (target.endsWith("next") ? isNext : !isNext);
        if (shouldFail) {
          
          if (failure === "null" || options?.acceptStatuses?.includes(404)) return null;
          throw new FatalHttpError("HTTP 404 regression fixture", 404);
        }
        if (url.pathname === "/api/v2/votacoes") return { dados: [votacao] };
        if (url.pathname === "/api/v2/eventos") return { dados: [evento] };
        if (isDetail) return { dados: votacao };
        if (isVotes || isAttendance) return {
          dados: isVotes ? [{ tipoVoto: "Sim", deputado_: deputado }] : [deputado],
          links: target.endsWith("next") && !isNext
            ? [{ rel: "next", href: `${base}${url.pathname.slice("/api/v2".length)}?pagina=2` }] : [],
        };
        throw new Error(`Unexpected URL: ${url}`);
      });
      const operation = target.startsWith("attendance")
        ? sincronizarPresencasCamara({ limiteSessoes: 1 })
        : sincronizarVotacoesCamara({ limite: 1 });
      await assert.rejects(
        operation,
        (target === "detail" || target === "votes-first") ? /Unexpected database transaction/ : failure === "404" ? /HTTP 404/ : /Resposta inválida/
      );
      assert.equal(transaction.mock.callCount(), (target === "detail" || target === "votes-first") ? 1 : 0, "No partial next page or attendance should be committed");
      if (target.endsWith("next")) assert.ok(requested.some(url => url.endsWith("?pagina=2")));
    });
  }
}

test("official aggregate tallies are used without fabricating nominal voter lists", async () => {
  const { obterContagensCamara } = await import("../lib/services/camaraNormalizer");
  assert.deepEqual(
    obterContagensCamara({ id:"123-4", data:"2022-02-01", descricao:"Aprovada", votosSim:40, votosNao:10, votosOutros:2 },null,[]),
    { sim:40, nao:10, abstencao:0, obstrucao:0, outros:2, agregado:true }
  );
  assert.deepEqual(
    obterContagensCamara({ id:"123-4", data:"2022-02-01", descricao:"Aprovada", votosSim:40, votosNao:10, votosOutros:2 },
      null, [{ tipoVoto:"Abstenção", deputado_:{id:1,nome:"Deputado"} }]),
    { sim:40, nao:10, abstencao:1, obstrucao:0, outros:1, agregado:true }
  );
});
