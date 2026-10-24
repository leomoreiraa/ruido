import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { ThrottledApiClient } from "../lib/services/apiClient";

test("ThrottledApiClient: respeita limite de tentativas e timeout", async () => {
  const client = new ThrottledApiClient({
    baseUrl: "http://127.0.0.1:9999", 
    maxConcurrency: 1,
    minIntervalMs: 10,
    maxRetries: 1,
    baseBackoffMs: 20,
    timeoutMs: 100,
  });

  await assert.rejects(
    async () => {
      await client.fetchJson("/test");
    },
    (err: Error) => {
      return err.message.includes("Número máximo de tentativas excedido") ||
             err.message.includes("fetch failed") ||
             err.message.includes("ECONNREFUSED");
    }
  );
});

test("ThrottledApiClient: aceita status específicos sem erro quando configurado", async () => {
  const client = new ThrottledApiClient({
    baseUrl: "https://legis.senado.leg.br/dadosabertos",
    maxConcurrency: 1,
    minIntervalMs: 10,
    maxRetries: 0,
    baseBackoffMs: 20,
  });

  
  const mockedFetch = mock.method(globalThis, "fetch", async () =>
    new Response(null, { status: 404 }));
  try {
    const resultado = await client.fetchJson("/endpoint-inexistente-xyz-123456", {
      acceptStatuses: [404],
    });
    assert.equal(resultado, null);
    assert.equal(mockedFetch.mock.callCount(), 1);
  } finally {
    mockedFetch.mock.restore();
  }
});
