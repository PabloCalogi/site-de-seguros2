const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../db');
const validar = require('../middleware/validate');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

function gerarToken(usuario) {
  return jwt.sign({ sub: usuario.id, perfil: usuario.perfil }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

function semSenha(usuario) {
  const { senha_hash, reset_token, reset_token_expires_at, ...resto } = usuario;
  return resto;
}

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Informe um e-mail válido.'),
    body('senha').notEmpty().withMessage('Informe a senha.'),
  ],
  validar,
  (req, res) => {
    const { email, senha } = req.body;
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.toLowerCase());

    if (!usuario || !bcrypt.compareSync(senha, usuario.senha_hash)) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
    }
    if (usuario.status !== 'ativo') {
      return res.status(403).json({ erro: 'Usuário inativo. Fale com o administrador.' });
    }

    const token = gerarToken(usuario);
    res.json({ token, usuario: semSenha(usuario) });
  }
);

// POST /api/auth/esqueci-senha
router.post(
  '/esqueci-senha',
  [body('email').isEmail().withMessage('Informe um e-mail válido.')],
  validar,
  (req, res) => {
    const { email } = req.body;
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.toLowerCase());

    // Resposta genérica sempre, para não revelar se o e-mail existe na base
    const respostaPadrao = {
      mensagem: 'Se o e-mail informado existir em nossa base, você receberá instruções de recuperação.',
    };

    if (!usuario) return res.json(respostaPadrao);

    const resetToken = crypto.randomBytes(32).toString('hex');
    const horasValidade = 1;
    const expiraEm = new Date(Date.now() + horasValidade * 60 * 60 * 1000).toISOString();

    db.prepare(
      'UPDATE usuarios SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?'
    ).run(resetToken, expiraEm, usuario.id);

    // Em produção: enviar e-mail com nodemailer contendo um link tipo
    // https://app.varginhaseguros.com.br/redefinir-senha?token=RESET_TOKEN
    // Por ora, devolvemos o token na resposta apenas em ambiente de desenvolvimento.
    if (process.env.NODE_ENV !== 'production') {
      return res.json({ ...respostaPadrao, dev_reset_token: resetToken });
    }

    res.json(respostaPadrao);
  }
);

// POST /api/auth/redefinir-senha
router.post(
  '/redefinir-senha',
  [
    body('token').notEmpty().withMessage('Token é obrigatório.'),
    body('novaSenha').isLength({ min: 6 }).withMessage('A nova senha deve ter ao menos 6 caracteres.'),
  ],
  validar,
  (req, res) => {
    const { token, novaSenha } = req.body;
    const usuario = db.prepare('SELECT * FROM usuarios WHERE reset_token = ?').get(token);

    if (!usuario || new Date(usuario.reset_token_expires_at) < new Date()) {
      return res.status(400).json({ erro: 'Token inválido ou expirado.' });
    }

    const novaSenhaHash = bcrypt.hashSync(novaSenha, 10);
    db.prepare(`
      UPDATE usuarios
      SET senha_hash = ?, reset_token = NULL, reset_token_expires_at = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(novaSenhaHash, usuario.id);

    res.json({ mensagem: 'Senha redefinida com sucesso.' });
  }
);

// GET /api/auth/me
router.get('/me', autenticar, (req, res) => {
  res.json(req.user);
});

module.exports = router;
