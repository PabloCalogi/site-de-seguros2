const express = require('express');
const { body, param } = require('express-validator');
const db = require('../db');
const validar = require('../middleware/validate');
const { autenticar, autorizar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/seguradoras
router.get('/', (req, res) => {
  const seguradoras = db.prepare('SELECT * FROM seguradoras ORDER BY nome ASC').all();
  res.json(seguradoras);
});

// GET /api/seguradoras/:id
router.get('/:id', [param('id').isInt()], validar, (req, res) => {
  const seguradora = db.prepare('SELECT * FROM seguradoras WHERE id = ?').get(req.params.id);
  if (!seguradora) return res.status(404).json({ erro: 'Seguradora não encontrada.' });
  res.json(seguradora);
});

const regras = [
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório.'),
  body('status').optional().isIn(['ativa', 'inativa']),
  body('tipo_integracao').optional().isIn(['api', 'manual']),
];

// POST /api/seguradoras  (apenas admin/gerente)
router.post('/', autorizar('admin', 'gerente'), regras, validar, (req, res) => {
  const { nome, status = 'ativa', tipo_integracao = 'manual', api_url, api_key, logo_url } = req.body;

  const existente = db.prepare('SELECT id FROM seguradoras WHERE nome = ?').get(nome);
  if (existente) return res.status(409).json({ erro: 'Já existe uma seguradora com este nome.' });

  const info = db.prepare(`
    INSERT INTO seguradoras (nome, status, tipo_integracao, api_url, api_key, logo_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(nome, status, tipo_integracao, api_url, api_key, logo_url);

  res.status(201).json(db.prepare('SELECT * FROM seguradoras WHERE id = ?').get(info.lastInsertRowid));
});

// PUT /api/seguradoras/:id
router.put('/:id', autorizar('admin', 'gerente'), [param('id').isInt(), ...regras], validar, (req, res) => {
  const seguradora = db.prepare('SELECT * FROM seguradoras WHERE id = ?').get(req.params.id);
  if (!seguradora) return res.status(404).json({ erro: 'Seguradora não encontrada.' });

  const { nome, status = 'ativa', tipo_integracao = 'manual', api_url, api_key, logo_url } = req.body;

  db.prepare(`
    UPDATE seguradoras SET
      nome = ?, status = ?, tipo_integracao = ?, api_url = ?, api_key = ?, logo_url = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(nome, status, tipo_integracao, api_url, api_key, logo_url, req.params.id);

  res.json(db.prepare('SELECT * FROM seguradoras WHERE id = ?').get(req.params.id));
});

// POST /api/seguradoras/:id/sincronizar — simula sincronização com a API da seguradora
router.post('/:id/sincronizar', autorizar('admin', 'gerente'), [param('id').isInt()], validar, (req, res) => {
  const seguradora = db.prepare('SELECT * FROM seguradoras WHERE id = ?').get(req.params.id);
  if (!seguradora) return res.status(404).json({ erro: 'Seguradora não encontrada.' });

  db.prepare(`UPDATE seguradoras SET ultima_sincronizacao = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json(db.prepare('SELECT * FROM seguradoras WHERE id = ?').get(req.params.id));
});

// DELETE /api/seguradoras/:id
router.delete('/:id', autorizar('admin'), [param('id').isInt()], validar, (req, res) => {
  const seguradora = db.prepare('SELECT * FROM seguradoras WHERE id = ?').get(req.params.id);
  if (!seguradora) return res.status(404).json({ erro: 'Seguradora não encontrada.' });

  const emUso = db.prepare('SELECT COUNT(*) AS c FROM cotacao_resultados WHERE seguradora_id = ?').get(req.params.id).c;
  if (emUso > 0) return res.status(409).json({ erro: 'Não é possível excluir: a seguradora possui cotações vinculadas.' });

  db.prepare('DELETE FROM seguradoras WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
