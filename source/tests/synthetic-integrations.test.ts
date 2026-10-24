import test from 'node:test';
import assert from 'node:assert/strict';
import { sincronizarEmendas, sincronizarPatrimonioTSE, sincronizarPresencasMandato } from '../lib/services/syncAvancado';
import { sincronizarVotacoesCamara, sincronizarPresencasCamara } from '../lib/services/syncCamaraService';

test('retired synthetic integrations reject without generating records', async () => {
  await assert.rejects(sincronizarEmendas(), /indisponíveis/);
  await assert.rejects(sincronizarPatrimonioTSE(), /indisponível/);
  await assert.rejects(sincronizarPresencasMandato(), /indisponível/);
});
test('unbounded historical pagination requires bounded dates before network access', async () => {
  await assert.rejects(sincronizarVotacoesCamara({ todasPaginas: true }), /31 dias/);
  await assert.rejects(sincronizarPresencasCamara({ todasPaginas: true, dataInicio: '2019-01-01', dataFim: '2019-12-31' }), /31 dias/);
});
