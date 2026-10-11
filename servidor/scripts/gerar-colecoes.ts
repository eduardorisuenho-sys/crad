/**
 * Gera a migração do PocketBase a partir do esquema único (dominio/src/esquema.ts).
 *
 * Cada vez que o esquema muda, nasce um arquivo novo em pb_migrations/ que
 * importa o conjunto completo de coleções (sem apagar as que não estão nele).
 * Se nada mudou, nenhum arquivo é criado.
 */
import { createHash } from 'node:crypto';
import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLECOES, type Campo, type Colecao } from '../../dominio/src/esquema';

const aqui = dirname(fileURLToPath(import.meta.url));
const pasta = join(aqui, '..', 'pb_migrations');

type CampoPB = Record<string, unknown>;

const campoId: CampoPB = {
  name: 'id',
  type: 'text',
  primaryKey: true,
  required: true,
  system: true,
  min: 15,
  max: 15,
  pattern: '^[a-z0-9]+$',
  autogeneratePattern: '[a-z0-9]{15}',
};
const datas: CampoPB[] = [
  { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
];
const txt = (name: string): CampoPB => ({ name, type: 'text' });
const num = (name: string): CampoPB => ({ name, type: 'number' });
const bool = (name: string): CampoPB => ({ name, type: 'bool' });
const json = (name: string): CampoPB => ({ name, type: 'json', maxSize: 2_000_000 });

// A validação de obrigatórios fica no domínio: no PocketBase, "obrigatório"
// recusaria 0 e false. Referências são texto (não "relation") porque, offline,
// um filho pode chegar antes do pai.
function campoPB(c: Campo): CampoPB {
  switch (c.tipo) {
    case 'texto':
    case 'data':
    case 'ref':
      return txt(c.nome);
    case 'numero':
      return num(c.nome);
    case 'bool':
      return bool(c.nome);
    case 'json':
      return json(c.nome);
    case 'arquivo':
      return { name: c.nome, type: 'file', maxSelect: 1, maxSize: 15_000_000, protected: true };
    case 'opcao':
      return { name: c.nome, type: 'select', values: [...c.opcoes!], maxSelect: c.multiplo ? c.opcoes!.length : 1 };
  }
}

const CONTROLE: CampoPB[] = [
  num('versao'),
  num('seq'),
  bool('excluido'),
  txt('criado_por'),
  txt('atualizado_por'),
  txt('dispositivo_id'),
  txt('criado_no_aparelho_em'),
];

// Todo acesso passa pelas rotas /api/crads/* (que aplicam perfis, viveiros e
// auditoria). As regras null deixam o acesso direto só para o superusuário.
const SEM_ACESSO_DIRETO = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };

function colecaoPB(c: Colecao) {
  const fields = [campoId, ...c.campos.map(campoPB), ...(c.porViveiro ? [txt('viveiro_id')] : []), ...CONTROLE, ...datas];
  const indexes = [`CREATE INDEX idx_${c.nome}_seq ON ${c.nome} (seq)`];
  if (c.porViveiro) indexes.push(`CREATE INDEX idx_${c.nome}_viveiro ON ${c.nome} (viveiro_id, seq)`);
  if (c.prefixoCodigo) indexes.push(`CREATE UNIQUE INDEX idx_${c.nome}_codigo ON ${c.nome} (codigo) WHERE codigo != ''`);
  if (c.campoDono && c.campoDono !== 'criado_por') indexes.push(`CREATE INDEX idx_${c.nome}_dono ON ${c.nome} (${c.campoDono})`);
  return { name: c.nome, type: 'base', fields, indexes, ...SEM_ACESSO_DIRETO };
}

/** Coleções só do servidor (não vão para o aparelho). */
const INTERNAS = [
  {
    name: 'auditoria',
    fields: [campoId, txt('colecao'), txt('registro_id'), txt('acao'), json('antes'), json('depois'), txt('usuario_id'), txt('dispositivo_id'), txt('data_aparelho'), ...datas],
    indexes: ['CREATE INDEX idx_auditoria_registro ON auditoria (colecao, registro_id)'],
  },
  {
    name: 'sync_op',
    fields: [campoId, txt('op_id'), txt('usuario_id'), json('resultado'), ...datas],
    indexes: ['CREATE UNIQUE INDEX idx_sync_op ON sync_op (op_id)'],
  },
  { name: 'sync_contador', fields: [campoId, num('valor'), ...datas], indexes: [] },
  {
    name: 'sequencia_codigo',
    fields: [campoId, txt('tipo'), num('ano'), num('proximo'), ...datas],
    indexes: ['CREATE UNIQUE INDEX idx_sequencia ON sequencia_codigo (tipo, ano)'],
  },
  {
    name: 'faixa_codigo',
    fields: [campoId, txt('dispositivo_id'), txt('usuario_id'), txt('tipo'), num('ano'), num('inicio'), num('fim'), ...datas],
    indexes: ['CREATE INDEX idx_faixa_dispositivo ON faixa_codigo (dispositivo_id)'],
  },
  {
    name: 'dispositivo',
    fields: [campoId, txt('usuario_id'), txt('nome'), txt('ultimo_envio'), txt('ultimo_recebimento'), ...datas],
    indexes: [],
  },
  {
    name: 'importacao',
    fields: [campoId, txt('tipo'), txt('usuario_id'), num('linhas_ok'), num('linhas_erro'), json('erros'), ...datas],
    indexes: [],
  },
].map((c) => ({ ...c, type: 'base', ...SEM_ACESSO_DIRETO }));

const colecoes = [...COLECOES.map(colecaoPB), ...INTERNAS];
const texto = JSON.stringify(colecoes, null, 1);
const hash = createHash('sha256').update(texto).digest('hex').slice(0, 10);

const existentes = readdirSync(pasta).filter((f) => f.endsWith('.js'));
if (existentes.some((f) => f.includes(`_esquema_${hash}.js`))) {
  console.log(`Esquema sem mudanças (${hash}).`);
} else {
  const nome = `${Math.floor(Date.now() / 1000)}_esquema_${hash}.js`;
  writeFileSync(
    join(pasta, nome),
    `/// Gerado por servidor/scripts/gerar-colecoes.ts a partir de dominio/src/esquema.ts. Não edite à mão.
migrate((app) => {
  app.importCollectionsByMarshaledJSON(${JSON.stringify(texto)}, false);
}, (app) => {
  // Desfazer não apaga dados: as coleções continuam existindo.
});
`,
  );
  console.log(`Migração criada: pb_migrations/${nome}`);
}
