const express = require('express');
const db = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

// GET /api/dashboard — KPIs e séries para os gráficos do painel
router.get('/', (req, res) => {
  const totalCotacoes = db.prepare('SELECT COUNT(*) AS c FROM cotacoes').get().c;
  const totalClientes = db.prepare('SELECT COUNT(*) AS c FROM clientes').get().c;
  const cotacoesConcluidas = db.prepare(`SELECT COUNT(*) AS c FROM cotacoes WHERE status = 'concluida'`).get().c;
  const cotacoesEmAndamento = db.prepare(`
    SELECT COUNT(*) AS c FROM cotacoes WHERE status IN ('em_andamento', 'aguardando_seguradoras')
  `).get().c;

  const taxaConversao = totalCotacoes > 0 ? Number(((cotacoesConcluidas / totalCotacoes) * 100).toFixed(1)) : 0;

  const ticketMedio = db.prepare(`
    SELECT AVG(melhor_valor) AS media FROM cotacoes WHERE status = 'concluida' AND melhor_valor IS NOT NULL
  `).get().media || 0;

  // Cotações dos últimos 6 meses, agrupadas por mês (para gráfico de linha/barras)
  const porMes = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS mes, COUNT(*) AS total,
           SUM(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) AS concluidas
    FROM cotacoes
    WHERE created_at >= datetime('now', '-6 months')
    GROUP BY mes
    ORDER BY mes ASC
  `).all();

  // Distribuição por status (para gráfico de pizza/rosca)
  const porStatus = db.prepare(`
    SELECT status, COUNT(*) AS total FROM cotacoes GROUP BY status
  `).all();

  // Ranking de seguradoras por número de propostas e valor médio
  const porSeguradora = db.prepare(`
    SELECT s.nome, COUNT(r.id) AS propostas, AVG(r.valor_anual) AS valor_medio,
           SUM(CASE WHEN r.status = 'selecionada' THEN 1 ELSE 0 END) AS vendas
    FROM seguradoras s
    LEFT JOIN cotacao_resultados r ON r.seguradora_id = s.id
    GROUP BY s.id
    ORDER BY vendas DESC, propostas DESC
  `).all();

  const ultimasCotacoes = db.prepare(`
    SELECT c.id, c.protocolo, c.status, c.melhor_valor, c.created_at, cl.nome AS cliente_nome
    FROM cotacoes c JOIN clientes cl ON cl.id = c.cliente_id
    ORDER BY c.created_at DESC LIMIT 5
  `).all();

  res.json({
    kpis: {
      totalCotacoes,
      totalClientes,
      cotacoesConcluidas,
      cotacoesEmAndamento,
      taxaConversao,
      ticketMedio: Number(ticketMedio.toFixed(2)),
    },
    graficos: {
      cotacoesPorMes: porMes,
      cotacoesPorStatus: porStatus,
      desempenhoSeguradoras: porSeguradora,
    },
    ultimasCotacoes,
  });
});

module.exports = router;
