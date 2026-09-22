const express = require('express');
const db = require('../db');
const { autenticar, autorizar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/configuracoes — retorna todas as configurações como objeto chave: valor
router.get('/', (req, res) => {
  const linhas = db.prepare('SELECT chave, valor FROM configuracoes').all();
  const config = Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
  res.json(config);
});

// PUT /api/configuracoes — atualiza/insere um conjunto de configurações (apenas admin)
router.put('/', autorizar('admin'), (req, res) => {
  const entradas = Object.entries(req.body || {});
  if (entradas.length === 0) {
    return res.status(400).json({ erro: 'Nenhuma configuração informada.' });
  }

  const upsert = db.prepare(`
    INSERT INTO configuracoes (chave, valor) VALUES (?, ?)
    ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor
  `);

  const transacao = db.transaction((itens) => {
    itens.forEach(([chave, valor]) => upsert.run(chave, String(valor)));
  });
  transacao(entradas);

  const linhas = db.prepare('SELECT chave, valor FROM configuracoes').all();
  res.json(Object.fromEntries(linhas.map((l) => [l.chave, l.valor])));
});

module.exports = router;
