const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './data/varginha_seguros.db';
const resolvedPath = path.resolve(process.cwd(), DB_PATH);

// Garante que a pasta do banco exista
const dir = path.dirname(resolvedPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    -- ==========================================================
    -- USUÁRIOS (equipe da corretora que acessa o sistema)
    -- ==========================================================
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'corretor' CHECK (perfil IN ('admin', 'gerente', 'corretor')),
      status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
      avatar_url TEXT,
      telefone TEXT,
      reset_token TEXT,
      reset_token_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ==========================================================
    -- CLIENTES
    -- ==========================================================
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf_cnpj TEXT NOT NULL UNIQUE,
      tipo_pessoa TEXT NOT NULL DEFAULT 'fisica' CHECK (tipo_pessoa IN ('fisica', 'juridica')),
      telefone TEXT,
      email TEXT,
      data_nascimento TEXT,
      cep TEXT,
      endereco TEXT,
      numero TEXT,
      bairro TEXT,
      cidade TEXT,
      uf TEXT,
      observacoes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ==========================================================
    -- SEGURADORAS (parceiras integradas ao multicotador)
    -- ==========================================================
    CREATE TABLE IF NOT EXISTS seguradoras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      logo_url TEXT,
      status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa')),
      tipo_integracao TEXT NOT NULL DEFAULT 'manual' CHECK (tipo_integracao IN ('api', 'manual')),
      api_url TEXT,
      api_key TEXT,
      ultima_sincronizacao TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ==========================================================
    -- COTAÇÕES (cabeçalho gerado pelo wizard "Nova Cotação")
    -- ==========================================================
    CREATE TABLE IF NOT EXISTS cotacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      protocolo TEXT NOT NULL UNIQUE,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,

      -- Etapa 2: Dados do veículo
      veiculo_placa TEXT,
      veiculo_marca TEXT,
      veiculo_modelo TEXT,
      veiculo_ano_fabricacao INTEGER,
      veiculo_ano_modelo INTEGER,
      veiculo_zero_km INTEGER NOT NULL DEFAULT 0,
      veiculo_uso TEXT DEFAULT 'particular',
      garagem INTEGER NOT NULL DEFAULT 0,
      cep_pernoite TEXT,

      -- Etapa 3: Coberturas contratadas (flags)
      cobertura_compreensiva INTEGER NOT NULL DEFAULT 0,
      cobertura_incendio INTEGER NOT NULL DEFAULT 0,
      cobertura_roubo INTEGER NOT NULL DEFAULT 0,
      cobertura_terceiros INTEGER NOT NULL DEFAULT 0,
      cobertura_vidros INTEGER NOT NULL DEFAULT 0,
      cobertura_assistencia INTEGER NOT NULL DEFAULT 0,
      cobertura_carro_reserva INTEGER NOT NULL DEFAULT 0,
      cobertura_morais INTEGER NOT NULL DEFAULT 0,

      -- Etapa 4: Resumo / status geral
      status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (
        status IN ('em_andamento', 'aguardando_seguradoras', 'concluida', 'expirada', 'cancelada')
      ),
      melhor_valor REAL,
      melhor_resultado_id INTEGER,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ==========================================================
    -- RESULTADOS DE COTAÇÃO POR SEGURADORA (linhas da tabela de comparação)
    -- ==========================================================
    CREATE TABLE IF NOT EXISTS cotacao_resultados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cotacao_id INTEGER NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
      seguradora_id INTEGER NOT NULL REFERENCES seguradoras(id) ON DELETE RESTRICT,
      plano TEXT,
      cobertura_resumo TEXT,
      franquia REAL,
      valor_anual REAL,
      valor_parcela REAL,
      parcelas INTEGER DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'disponivel' CHECK (
        status IN ('disponivel', 'indisponivel', 'selecionada')
      ),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ==========================================================
    -- HISTÓRICO DE EVENTOS DE UMA COTAÇÃO (linha do tempo / status log)
    -- ==========================================================
    CREATE TABLE IF NOT EXISTS cotacao_historico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cotacao_id INTEGER NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      evento TEXT NOT NULL,
      descricao TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ==========================================================
    -- CONFIGURAÇÕES DA CORRETORA (registro único, chave/valor)
    -- ==========================================================
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_cotacoes_cliente ON cotacoes(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_cotacoes_status ON cotacoes(status);
    CREATE INDEX IF NOT EXISTS idx_resultados_cotacao ON cotacao_resultados(cotacao_id);
    CREATE INDEX IF NOT EXISTS idx_historico_cotacao ON cotacao_historico(cotacao_id);
  `);
}

init();

module.exports = db;
