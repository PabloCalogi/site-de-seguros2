const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const db = require('../db');
const validar = require('../middleware/validate');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

function semSenha(usuario) {
  const { senha_hash, reset_token, reset_token_expires_at, ...resto } = usuario;
  return resto;
}

// GET /api/perfil
router.get('/', (req, res) => {
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id);
  res.json(semSenha(usuario));
});

// PUT /api/perfil — atualiza nome, telefone, avatar (não altera perfil/status/email de outro)
router.put(
  '/',
  [body('nome').trim().notEmpty().withMessage('Nome é obrigatório.')],
  validar,
  (req, res) => {
    const { nome, telefone, avatar_url } = req.body;
    db.prepare(`
      UPDATE usuarios SET nome = ?, telefone = ?, avatar_url = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nome, telefone, avatar_url, req.user.id);

    res.json(semSenha(db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id)));
  }
);

// PATCH /api/perfil/senha — troca a própria senha exigindo a senha atual
router.patch(
  '/senha',
  [
    body('senhaAtual').notEmpty().withMessage('Informe a senha atual.'),
    body('novaSenha').isLength({ min: 6 }).withMessage('A nova senha deve ter ao menos 6 caracteres.'),
  ],
  validar,
  (req, res) => {
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(req.body.senhaAtual, usuario.senha_hash)) {
      return res.status(401).json({ erro: 'Senha atual incorreta.' });
    }

    const novaSenhaHash = bcrypt.hashSync(req.body.novaSenha, 10);
    db.prepare(`UPDATE usuarios SET senha_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(novaSenhaHash, usuario.id);
    res.json({ mensagem: 'Senha alterada com sucesso.' });
  }
);

module.exports = router;
