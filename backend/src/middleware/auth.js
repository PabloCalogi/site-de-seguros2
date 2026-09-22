const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * Exige um token JWT válido no header Authorization: Bearer <token>.
 * Anexa o usuário autenticado em req.user (sem o hash da senha).
 */
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({ erro: 'Token de autenticação não informado.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = db.prepare(
      'SELECT id, nome, email, perfil, status, avatar_url, telefone FROM usuarios WHERE id = ?'
    ).get(payload.sub);

    if (!usuario || usuario.status !== 'ativo') {
      return res.status(401).json({ erro: 'Usuário inválido ou inativo.' });
    }

    req.user = usuario;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

/**
 * Restringe o acesso a determinados perfis.
 * Uso: autorizar('admin', 'gerente')
 */
function autorizar(...perfis) {
  return (req, res, next) => {
    if (!req.user || !perfis.includes(req.user.perfil)) {
      return res.status(403).json({ erro: 'Você não tem permissão para executar esta ação.' });
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
