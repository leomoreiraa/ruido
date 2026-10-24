"""Remove only rows matching the retired generators; backup first, dry-run by default.
Run: python -I scripts/cleanup-synthetic-data.py prisma/dev.db [--apply]
Unknown rows are retained, never classified by a source label alone.
"""
import datetime
import math
import pathlib
import re
import sqlite3
import sys

path = pathlib.Path(sys.argv[1]).resolve()
if not path.is_file():
    raise SystemExit('Database does not exist')
conn = sqlite3.connect(path)
conn.row_factory = sqlite3.Row
round_js = lambda x: math.floor(x + 0.5)
people = {p['id']: p for p in conn.execute('SELECT id,nome,uf,casa FROM Parlamentar')}
matched = {t: [] for t in ['Presenca', 'EmendaParlamentar', 'BemDeclarado', 'Discurso']}
justifications = [
    'Licença para tratamento de saúde comprovada por laudo médico oficial',
    'Missão oficial autorizada pela Mesa Diretora da Casa Legislativa',
    'Participação em conferência oficial em representação institucional',
    'Atividade político-partidária oficial autorizada pelo regimento',
    'Licença maternidade/paternidade em cumprimento aos prazos regimentais',
]
calendar = {(2,7),(2,14),(3,8),(3,22),(4,11),(4,25),(5,9),(5,23),(6,13),(6,27),(8,8),(8,22),(9,12),(9,26),(10,10),(10,24),(11,7),(11,21),(12,5),(12,19)}
for r in conn.execute('SELECT * FROM Presenca'):
    m = re.fullmatch(r'SES-(2019|202[0-6])-(\d{2})(\d{2})', r['sessaoExternalId'])
    if not m: continue
    y,mo,d = map(int,m.groups())
    if (mo,d) not in calendar or (y == 2026 and mo > 10): continue
    p = people[r['parlamentarId']]
    seed = sum(map(ord,p['nome']))
    score = (seed*31 + (y*100+mo*10+d)*17)%100
    status = 'AUSENTE' if score >= 95 else 'JUSTIFICADO' if score >= 88 else 'PRESENTE'
    justification = justifications[(seed+mo)%5] if status == 'JUSTIFICADO' else None
    url = ('https://www.camara.leg.br/presenca-comissoes/pesquisa-reuniao?sessao=' if p['casa']=='CAMARA' else 'https://www25.senado.leg.br/web/atividade/sessoes-plenarias/-/sessao/')+r['sessaoExternalId']
    timestamp = int(datetime.datetime(y,mo,d,14,tzinfo=datetime.timezone.utc).timestamp()*1000)
    if r['status']==status and r['justificativa']==justification and r['fonteUrl']==url and r['dataSessao']==timestamp and r['cobertura']=='CHAMADA_OFICIAL':
        matched['Presenca'].append(r['id'])
functions = [
 ('Saúde','Atenção Primária à Saúde e custeio de unidades de atendimento SUS'),
 ('Educação','Infraestrutura de escolas municipais e transporte escolar da rede básica'),
 ('Infraestrutura e Urbanismo','Pavimentação de vias urbanas, drenagem e reformas comunitárias'),
 ('Segurança Pública','Equipamentos, viaturas e infraestrutura de segurança para guardas civis'),
 ('Assistência Social','Ações de suporte a famílias vulneráveis e centros de assistência'),
 ('Agricultura e Pecuária','Fomento à agricultura familiar e equipamentos para pequenos produtores'),
]
for r in conn.execute('SELECT * FROM EmendaParlamentar'):
    p = people[r['parlamentarId']]; y = r['ano']; city = r['municipioBeneficiado']; name = p['nome']
    for old in [False,True]:
        for kind in [1,2,3]:
            if r['codigoEmenda'] != f"{y}{p['id'][-4:]}000{kind}": continue
            if kind == 1:
                value = 2500000+ord(name[0])*12345%2000000 if old else 2200000+(ord(name[0])*12345+y*37)%2500000
                paid = round_js(value*(.9 if old else .85+(y%2)*.1))
                desc = f'Apoio à manutenção de unidades de saúde e custeio SUS em {city}'
                typ,func = 'INDIVIDUAL','Saúde'
            elif kind == 2:
                value = 1800000+ord(name[1])*9876%1200000 if old else 1500000+(ord(name[1])*9876+y*19)%1500000
                paid = value
                pix = old or y>=2019
                desc = f'Transferência Especial direta (Emenda PIX) para o tesouro municipal de {city}' if pix else f'Emenda Individual para custeio e pavimentação de vias urbanas em {city}'
                typ,func = ('TRANSFERENCIA_ESPECIAL' if pix else 'INDIVIDUAL'),'Infraestrutura e Urbanismo'
            else:
                value = 4000000+ord(name[0])*23456%3000000 if old else 3500000+(ord(name[0])*23456+y*41)%3000000
                paid = round_js(value*(.75 if old else .78))
                func,desc0 = functions[(ord(name[2])+(0 if old else y))%6]
                desc = f'{desc0} na região de {city}'; typ='BANCADA'
            if (r['valorEmpenhado'],r['valorPago'],r['descricao'],r['tipo'],r['funcao'],r['status'],r['fonte'],r['ufBeneficiada']) == (value,paid,desc,typ,func,'PAGO','PORTAL_TRANSPARENCIA',p['uf']):
                matched['EmendaParlamentar'].append(r['id'])
for r in conn.execute('SELECT * FROM BemDeclarado'):
    p=people[r['parlamentarId']]; seed=sum(map(ord,p['nome'])); y=r['anoEleicao']
    base=180000+(seed*11321)%650000
    totals={2006:base}
    for year,factor in [(2010,1.20+(seed%25)/100),(2014,1.25+((seed+1)%30)/100),(2018,1.18+((seed+2)%35)/100),(2022,1.15+((seed+3)%45)/100)]:
        base=round_js(base*factor); totals[year]=base
    total=totals.get(y,round_js(totals[2018]*(1+(y-2018)*.08)))
    a,b=round_js(total*.58),round_js(total*.16)
    expected=[('Imóvel Residencial',f'Imóvel residencial declarado na prestação de contas da Eleição {y} no estado de {p["uf"]}',a,total),('Veículo automotor',f'Veículo automotor particular declarado na Eleição {y}',b,total),('Quotas e Participações Societárias' if y>=2018 else 'Aplicações e Investimentos',f'Aplicações financeiras e ativos bancários declarados perante a Justiça Eleitoral em {y}',total-a-b,total)]
    oldbase=450000+(seed*17431)%1800000
    oldvals=[round_js(oldbase*f) for f in [.6,.15,.25]]
    if y==2018:
        descriptions=[f'Apartamento residencial registrado em cartório no estado de {p["uf"]}','Veículo de passeio particular automotor','Aplicação de renda fixa e caderneta de poupança em instituição financeira oficial']
        types=['Imóvel Residencial','Veículo automotor','Aplicações e Investimentos']
        expected += [(t,d,v,sum(oldvals)) for t,d,v in zip(types,descriptions,oldvals)]
    elif y==2022:
        oldtotal=round_js(sum(oldvals)*(1.15+(seed%50)/100))
        vals=[round_js(oldtotal*f) for f in [.55,.18,.27]]
        descriptions=[f'Imóvel residencial urbano averbado na cidade de atuação em {p["uf"]}','Veículo utilitário automotor adquirido','Cotas de capital societário e aplicações financeiras bancárias']
        types=['Imóvel Residencial','Veículo automotor','Quotas e Participações Societárias']
        expected += [(t,d,v,sum(vals)) for t,d,v in zip(types,descriptions,vals)]
    if (r['tipoBem'],r['descricao'],r['valorDeclarado'],r['totalPatrimonioAno']) in expected:
        matched['BemDeclarado'].append(r['id'])
for r in conn.execute('SELECT * FROM Discurso'):
    if r['transcricao'] in ['Pronunciamento em plenário sobre matérias legislativas e interesse público','Pronunciamento em plenário: Discurso oficial'] and not r['sumario']:
        matched['Discurso'].append(r['id'])
print('Confirmed generator matches:',{t:len(set(ids)) for t,ids in matched.items()})
if '--apply' in sys.argv:
    backup=path.with_name(path.stem+'.before-cleanup-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.db')
    with sqlite3.connect(backup) as dest:
        conn.backup(dest)
        assert dest.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    print('Verified backup:',backup)
    conn.execute('PRAGMA foreign_keys=ON')
    with conn:
        for table,ids in matched.items():
            conn.executemany(f'DELETE FROM {table} WHERE id=?',[(i,) for i in set(ids)])
    print('Integrity:',conn.execute('PRAGMA integrity_check').fetchone()[0])
    print('Foreign key errors:',len(conn.execute('PRAGMA foreign_key_check').fetchall()))
for table in matched:
    print('Remaining',table,conn.execute(f'SELECT count(*) FROM {table}').fetchone()[0])
conn.close()
