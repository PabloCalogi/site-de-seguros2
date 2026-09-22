const express = require('express');
const { body, param, query } = require('express-validator');
const db = require('../db');
const validar = require('../middleware/validate');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/clientes?busca=&page=&pageSize=
router.get('/', [query('page').optional().isInt({ min: 1 }), query('pageSize').optional().isInt({ min: 1, max: 100 })], validar, (req, res) => {
  const { busca = '' } = req.query;
  const page = parseInt(req.query.page || '1', 10);
  const pageSize = parseInt(req.query.pageSize || '20', 10);
  const offset = (page - 1) * pageSize;

  const filtro = `%${busca}%`;
  const total = db.prepare(`
    SELECT COUNT(*) AS c FROM clientes
    WHERE nome LIKE ? OR cpf_cnpj LIKE ? OR email LIKE ?
  `).get(filtro, filtro, filtro).c;

  const clientes = db.prepare(`
    SELECT * FROM clientes
    WHERE nome LIKE ? OR cpf_cnpj LIKE ? OR email LIKE ?
    ORDER BY nome ASC
    LIMIT ? OFFSET ?
  `).all(filtro, filtro, filtro, pageSize, offset);

  res.json({ dados: clientes, total, page, pageSize });
});

// GET /api/clientes/:id
router.get('/:id', [param('id').isInt()], validar, (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

  const cotacoes = db.prepare(`
    SELECT id, protocolo, status, melhor_valor, created_at
    FROM cotacoes WHERE cliente_id = ? ORDER BY created_at DESC
  `).all(req.params.id);

  res.json({ ...cliente, cotacoes });
});

const regrasCliente = [
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório.'),
  body('cpf_cnpj').trim().notEmpty().withMessage('CPF/CNPJ é obrigatório.'),
  body('tipo_pessoa').optional().isIn(['fisica', 'juridica']),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('E-mail inválido.'),
];

// POST /api/clientes
router.post('/', regrasCliente, validar, (req, res) => {
  const {
    nome, cpf_cnpj, tipo_pessoa = 'fisica', telefone, email,
    data_nascimento, cep, endereco, numero, bairro, cidade, uf, observacoes,
  } = req.body;

  const existente = db.prepare('SELECT id FROM clientes WHERE cpf_cnpj = ?').get(cpf_cnpj);
  if (existente) return res.status(409).json({ erro: 'Já existe um cliente com este CPF/CNPJ.' });

  const info = db.prepare(`
    INSERT INTO clientes (nome, cpf_cnpj, tipo_pessoa, telefone, email, data_nascimento, cep, endereco, numero, bairro, cidade, uf, observacoes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nome, cpf_cnpj, tipo_pessoa, telefone, email, data_nascimento, cep, endereco, numero, bairro, cidade, uf, observacoes);

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(cliente);
});

// PUT /api/clientes/:id
router.put('/:id', [param('id').isInt(), ...regrasCliente], validar, (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

  const {
    nome, cpf_cnpj, tipo_pessoa = 'fisica', telefone, email,
    data_nascimento, cep, endereco, numero, bairro, cidade, uf, observacoes,
  } = req.body;

  const duplicado = db.prepare('SELECT id FROM clientes WHERE cpf_cnpj = ? AND id != ?').get(cpf_cnpj, req.params.id);
  if (duplicado) return res.status(409).json({ erro: 'Já existe outro cliente com este CPF/CNPJ.' });

  db.prepare(`
    UPDATE clientes SET
      nome = ?, cpf_cnpj = ?, tipo_pessoa = ?, telefone = ?, email = ?,
      data_nascimento = ?, cep = ?, endereco = ?, numero = ?, bairro = ?, cidade = ?, uf = ?, observacoes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(nome, cpf_cnpj, tipo_pessoa, telefone, email, data_nascimento, cep, endereco, numero, bairro, cidade, uf, observacoes, req.params.id);

  res.json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id));
});

// DELETE /api/clientes/:id
router.delete('/:id', [param('id').isInt()], validar, (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

  const temCotacoes = db.prepare('SELECT COUNT(*) AS c FROM cotacoes WHERE cliente_id = ?').get(req.params.id).c;
  if (temCotacoes > 0) {
    return res.status(409).json({ erro: 'Não é possível excluir: o cliente possui cotações vinculadas.' });
  }

  db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
