const { validationResult } = require('express-validator');

/**
 * Executa após as regras do express-validator; retorna 422 com a lista
 * de erros caso alguma regra tenha falhado.
 */
function validar(req, res, next) {
  const erros = validationResult(req);
  if (!erros.isEmpty()) {
    return res.status(422).json({
      erro: 'Dados inválidos.',
      detalhes: erros.array().map((e) => ({ campo: e.path, mensagem: e.msg })),
    });
  }
  next();
}

module.exports = validar;
