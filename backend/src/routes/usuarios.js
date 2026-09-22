const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param } = require('express-validator');
const db = require('../db');
const validar = require('../middleware/validate');
const { autenticar, autorizar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

function semSenha(usuario) {
  const { senha_hash, reset_token, reset_token_expires_at, ...resto } = usuario;
  return resto;
}

// GET /api/usuarios — apenas admin/gerente
router.get('/', autorizar('admin', 'gerente'), (req, res) => {
  const usuarios = db.prepare('SELECT * FROM usuarios ORDER BY nome ASC').all();
  res.json(usuarios.map(semSenha));
});

// GET /api/usuarios/:id
router.get('/:id', autorizar('admin', 'gerente'), [param('id').isInt()], validar, (req, res) => {
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  res.json(semSenha(usuario));
});

const regrasCriacao = [
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório.'),
  body('email').isEmail().withMessage('E-mail inválido.'),
  body('senha').isLength({ min: 6 }).withMessage('A senha deve ter ao menos 6 caracteres.'),
  body('perfil').optional().isIn(['admin', 'gerente', 'corretor']),
];

// POST /api/usuarios — apenas admin
router.post('/', autorizar('admin'), regrasCriacao, validar, (req, res) => {
  const { nome, email, senha, perfil = 'corretor', telefone, status = 'ativo' } = req.body;

  const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.toLowerCase());
  if (existente) return res.status(409).json({ erro: 'Já existe um usuário com este e-mail.' });

  const senhaHash = bcrypt.hashSync(senha, 10);
  const info = db.prepare(`
    INSERT INTO usuarios (nome, email, senha_hash, perfil, status, telefone)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(nome, email.toLowerCase(), senhaHash, perfil, status, telefone);

  res.status(201).json(semSenha(db.prepare('SELECT * FROM usuarios WHERE id = ?').get(info.lastInsertRowid)));
});

// PUT /api/usuarios/:id — apenas admin (edição completa, incl. perfil/status)
router.put(
  '/:id',
  autorizar('admin'),
  [
    param('id').isInt(),
    body('nome').trim().notEmpty().withMessage('Nome é obrigatório.'),
    body('email').isEmail().withMessage('E-mail inválido.'),
    body('perfil').optional().isIn(['admin', 'gerente', 'corretor']),
    body('status').optional().isIn(['ativo', 'inativo']),
  ],
  validar,
  (req, res) => {
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const { nome, email, perfil = usuario.perfil, status = usuario.status, telefone } = req.body;

    const duplicado = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(email.toLowerCase(), req.params.id);
    if (duplicado) return res.status(409).json({ erro: 'Já existe outro usuário com este e-mail.' });

    db.prepare(`
      UPDATE usuarios SET nome = ?, email = ?, perfil = ?, status = ?, telefone = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nome, email.toLowerCase(), perfil, status, telefone, req.params.id);

    res.json(semSenha(db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id)));
  }
);

// PATCH /api/usuarios/:id/senha — redefine a senha de um usuário (admin) ou a própria (qualquer usuário)
router.patch(
  '/:id/senha',
  [param('id').isInt(), body('novaSenha').isLength({ min: 6 }).withMessage('A senha deve ter ao menos 6 caracteres.')],
  validar,
  (req, res) => {
    const alvoId = parseInt(req.params.id, 10);
    if (req.user.perfil !== 'admin' && req.user.id !== alvoId) {
      return res.status(403).json({ erro: 'Você só pode alterar a própria senha.' });
    }

    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(alvoId);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const senhaHash = bcrypt.hashSync(req.body.novaSenha, 10);
    db.prepare(`UPDATE usuarios SET senha_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(senhaHash, alvoId);
    res.json({ mensagem: 'Senha atualizada com sucesso.' });
  }
);

// DELETE /api/usuarios/:id — apenas admin
router.delete('/:id', autorizar('admin'), [param('id').isInt()], validar, (req, res) => {
  if (parseInt(req.params.id, 10) === req.user.id) {
    return res.status(400).json({ erro: 'Você não pode excluir seu próprio usuário.' });
  }
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

  db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
