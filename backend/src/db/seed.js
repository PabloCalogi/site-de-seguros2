require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./index');

function seed() {
  const usuarioCount = db.prepare('SELECT COUNT(*) AS c FROM usuarios').get().c;

  if (usuarioCount === 0) {
    const senhaHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO usuarios (nome, email, senha_hash, perfil, status)
      VALUES (?, ?, ?, 'admin', 'ativo')
    `).run('Administrador', 'admin@varginhaseguros.com.br', senhaHash);
    console.log('✔ Usuário admin criado: admin@varginhaseguros.com.br / admin123');
  }

  const seguradoraCount = db.prepare('SELECT COUNT(*) AS c FROM seguradoras').get().c;
  if (seguradoraCount === 0) {
    const seguradoras = [
      ['Porto Seguro', 'api', 'ativa'],
      ['Azul Seguros', 'api', 'ativa'],
      ['Allianz', 'manual', 'ativa'],
      ['Tokio Marine', 'manual', 'ativa'],
      ['HDI Seguros', 'api', 'inativa'],
    ];
    const stmt = db.prepare(`
      INSERT INTO seguradoras (nome, tipo_integracao, status, ultima_sincronizacao)
      VALUES (?, ?, ?, datetime('now'))
    `);
    seguradoras.forEach(([nome, tipo, status]) => stmt.run(nome, tipo, status));
    console.log('✔ Seguradoras de exemplo criadas');
  }

  const clienteCount = db.prepare('SELECT COUNT(*) AS c FROM clientes').get().c;
  if (clienteCount === 0) {
    db.prepare(`
      INSERT INTO clientes (nome, cpf_cnpj, tipo_pessoa, telefone, email, cidade, uf)
      VALUES (?, ?, 'fisica', ?, ?, ?, ?)
    `).run('João da Silva', '123.456.789-00', '(35) 99999-0000', 'joao@example.com', 'Varginha', 'MG');
    console.log('✔ Cliente de exemplo criado');
  }

  const configCount = db.prepare('SELECT COUNT(*) AS c FROM configuracoes').get().c;
  if (configCount === 0) {
    const defaults = {
      corretora_nome: 'Varginha Seguros',
      corretora_cnpj: '00.000.000/0001-00',
      corretora_email: 'contato@varginhaseguros.com.br',
      corretora_telefone: '(35) 3222-0000',
      corretora_endereco: 'Varginha, MG',
      susep: '',
      tema: 'claro',
    };
    const stmt = db.prepare('INSERT INTO configuracoes (chave, valor) VALUES (?, ?)');
    Object.entries(defaults).forEach(([chave, valor]) => stmt.run(chave, valor));
    console.log('✔ Configurações padrão criadas');
  }

  console.log('Seed concluído.');
}

seed();
