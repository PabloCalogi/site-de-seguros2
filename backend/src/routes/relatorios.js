const express = require('express');
const { query } = require('express-validator');
const db = require('../db');
const validar = require('../middleware/validate');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/relatorios/cotacoes?de=YYYY-MM-DD&ate=YYYY-MM-DD&status=&seguradoraId=
router.get(
  '/cotacoes',
  [
    query('de').optional().isISO8601(),
    query('ate').optional().isISO8601(),
    query('status').optional().isString(),
    query('seguradoraId').optional().isInt(),
  ],
  validar,
  (req, res) => {
    const { de, ate, status, seguradoraId } = req.query;

    const condicoes = [];
    const params = [];

    if (de) { condicoes.push('c.created_at >= ?'); params.push(de); }
    if (ate) { condicoes.push('c.created_at <= ?'); params.push(`${ate} 23:59:59`); }
    if (status) { condicoes.push('c.status = ?'); params.push(status); }

    let joinResultados = '';
    if (seguradoraId) {
      joinResultados = 'JOIN cotacao_resultados r ON r.cotacao_id = c.id AND r.seguradora_id = ?';
      params.unshift(seguradoraId);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    const linhas = db.prepare(`
      SELECT DISTINCT c.id, c.protocolo, c.status, c.melhor_valor, c.created_at,
             cl.nome AS cliente_nome, c.veiculo_marca, c.veiculo_modelo, c.veiculo_placa
      FROM cotacoes c
      JOIN clientes cl ON cl.id = c.cliente_id
      ${joinResultados}
      ${where}
      ORDER BY c.created_at DESC
    `).all(...params);

    const resumo = {
      totalRegistros: linhas.length,
      valorTotal: Number(linhas.reduce((soma, l) => soma + (l.melhor_valor || 0), 0).toFixed(2)),
      porStatus: linhas.reduce((acc, l) => {
        acc[l.status] = (acc[l.status] || 0) + 1;
        return acc;
      }, {}),
    };

    res.json({ resumo, linhas });
  }
);

// GET /api/relatorios/seguradoras — desempenho comparativo entre seguradoras
router.get('/seguradoras', (req, res) => {
  const dados = db.prepare(`
    SELECT s.id, s.nome, s.status,
           COUNT(r.id) AS total_propostas,
           SUM(CASE WHEN r.status = 'selecionada' THEN 1 ELSE 0 END) AS total_vendas,
           AVG(r.valor_anual) AS valor_medio,
           MIN(r.valor_anual) AS menor_valor,
           MAX(r.valor_anual) AS maior_valor
    FROM seguradoras s
    LEFT JOIN cotacao_resultados r ON r.seguradora_id = s.id
    GROUP BY s.id
    ORDER BY total_vendas DESC
  `).all();

  res.json(dados);
});

// GET /api/relatorios/clientes — clientes com mais cotações
router.get('/clientes', (req, res) => {
  const dados = db.prepare(`
    SELECT cl.id, cl.nome, cl.cpf_cnpj,
           COUNT(c.id) AS total_cotacoes,
           SUM(CASE WHEN c.status = 'concluida' THEN 1 ELSE 0 END) AS cotacoes_concluidas
    FROM clientes cl
    LEFT JOIN cotacoes c ON c.cliente_id = cl.id
    GROUP BY cl.id
    ORDER BY total_cotacoes DESC
  `).all();

  res.json(dados);
});

module.exports = router;
