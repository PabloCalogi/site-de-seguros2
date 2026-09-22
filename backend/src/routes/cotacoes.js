const express = require('express');
const { body, param, query } = require('express-validator');
const db = require('../db');
const validar = require('../middleware/validate');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);

const CAMPOS_COBERTURA = [
  'cobertura_compreensiva', 'cobertura_incendio', 'cobertura_roubo', 'cobertura_terceiros',
  'cobertura_vidros', 'cobertura_assistencia', 'cobertura_carro_reserva', 'cobertura_morais',
];

function gerarProtocolo() {
  const ano = new Date().getFullYear();
  const aleatorio = Math.floor(100000 + Math.random() * 900000);
  return `VG-${ano}-${aleatorio}`;
}

function registrarHistorico(cotacaoId, usuarioId, evento, descricao = null) {
  db.prepare(`
    INSERT INTO cotacao_historico (cotacao_id, usuario_id, evento, descricao)
    VALUES (?, ?, ?, ?)
  `).run(cotacaoId, usuarioId, evento, descricao);
}

function buscarCotacaoCompleta(id) {
  const cotacao = db.prepare(`
    SELECT c.*, cl.nome AS cliente_nome, cl.cpf_cnpj AS cliente_cpf_cnpj,
           cl.telefone AS cliente_telefone, cl.email AS cliente_email,
           u.nome AS usuario_nome
    FROM cotacoes c
    JOIN clientes cl ON cl.id = c.cliente_id
    LEFT JOIN usuarios u ON u.id = c.usuario_id
    WHERE c.id = ?
  `).get(id);

  if (!cotacao) return null;

  const resultados = db.prepare(`
    SELECT r.*, s.nome AS seguradora_nome, s.logo_url AS seguradora_logo
    FROM cotacao_resultados r
    JOIN seguradoras s ON s.id = r.seguradora_id
    WHERE r.cotacao_id = ?
    ORDER BY r.valor_anual ASC
  `).all(id);

  const historico = db.prepare(`
    SELECT h.*, u.nome AS usuario_nome
    FROM cotacao_historico h
    LEFT JOIN usuarios u ON u.id = h.usuario_id
    WHERE h.cotacao_id = ?
    ORDER BY h.created_at ASC
  `).all(id);

  return { ...cotacao, resultados, historico };
}

// =========================================================================
// GET /api/cotacoes  — listagem/histórico com filtros (usado por Cotações e
// Histórico de Cotação)
// =========================================================================
router.get(
  '/',
  [
    query('status').optional().isString(),
    query('clienteId').optional().isInt(),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
  ],
  validar,
  (req, res) => {
    const { status, clienteId, busca = '' } = req.query;
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '20', 10);
    const offset = (page - 1) * pageSize;

    const condicoes = [];
    const params = [];

    if (status) { condicoes.push('c.status = ?'); params.push(status); }
    if (clienteId) { condicoes.push('c.cliente_id = ?'); params.push(clienteId); }
    if (busca) {
      condicoes.push('(c.protocolo LIKE ? OR cl.nome LIKE ? OR c.veiculo_placa LIKE ?)');
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    const total = db.prepare(`
      SELECT COUNT(*) AS c FROM cotacoes c JOIN clientes cl ON cl.id = c.cliente_id ${where}
    `).get(...params).c;

    const cotacoes = db.prepare(`
      SELECT c.id, c.protocolo, c.status, c.melhor_valor, c.created_at,
             c.veiculo_marca, c.veiculo_modelo, c.veiculo_placa,
             cl.id AS cliente_id, cl.nome AS cliente_nome
      FROM cotacoes c
      JOIN clientes cl ON cl.id = c.cliente_id
      ${where}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({ dados: cotacoes, total, page, pageSize });
  }
);

// GET /api/cotacoes/:id — tela "Detalhes de Cotação" / "Detalhes do Histórico"
router.get('/:id', [param('id').isInt()], validar, (req, res) => {
  const cotacao = buscarCotacaoCompleta(req.params.id);
  if (!cotacao) return res.status(404).json({ erro: 'Cotação não encontrada.' });
  res.json(cotacao);
});

// =========================================================================
// POST /api/cotacoes — cria a cotação completa (consolidação do wizard de
// 4 etapas: cliente, veículo, coberturas, resumo)
// =========================================================================
router.post(
  '/',
  [
    body('clienteId').isInt().withMessage('Selecione um cliente.'),
    body('veiculo.placa').optional().isString(),
    body('veiculo.marca').optional().isString(),
    body('veiculo.modelo').optional().isString(),
    body('veiculo.anoFabricacao').optional().isInt(),
    body('veiculo.anoModelo').optional().isInt(),
    body('veiculo.garagem').optional().isBoolean(),
    body('coberturas').optional().isObject(),
  ],
  validar,
  (req, res) => {
    const { clienteId, veiculo = {}, coberturas = {} } = req.body;

    const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(clienteId);
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    const protocolo = gerarProtocolo();

    const coberturaValores = CAMPOS_COBERTURA.map((campo) => {
      const chave = campo.replace('cobertura_', '');
      return coberturas[chave] ? 1 : 0;
    });

    const info = db.prepare(`
      INSERT INTO cotacoes (
        protocolo, cliente_id, usuario_id,
        veiculo_placa, veiculo_marca, veiculo_modelo, veiculo_ano_fabricacao, veiculo_ano_modelo,
        veiculo_zero_km, veiculo_uso, garagem, cep_pernoite,
        ${CAMPOS_COBERTURA.join(', ')},
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${CAMPOS_COBERTURA.map(() => '?').join(', ')}, 'em_andamento')
    `).run(
      protocolo, clienteId, req.user.id,
      veiculo.placa || null, veiculo.marca || null, veiculo.modelo || null,
      veiculo.anoFabricacao || null, veiculo.anoModelo || null,
      veiculo.zeroKm ? 1 : 0, veiculo.uso || 'particular', veiculo.garagem ? 1 : 0, veiculo.cepPernoite || null,
      ...coberturaValores
    );

    registrarHistorico(info.lastInsertRowid, req.user.id, 'criacao', 'Cotação criada pelo wizard.');

    res.status(201).json(buscarCotacaoCompleta(info.lastInsertRowid));
  }
);

// PUT /api/cotacoes/:id — edita dados do veículo/coberturas de uma cotação existente
router.put('/:id', [param('id').isInt()], validar, (req, res) => {
  const cotacao = db.prepare('SELECT * FROM cotacoes WHERE id = ?').get(req.params.id);
  if (!cotacao) return res.status(404).json({ erro: 'Cotação não encontrada.' });

  const { veiculo = {}, coberturas = {} } = req.body;

  const coberturaValores = CAMPOS_COBERTURA.map((campo) => {
    const chave = campo.replace('cobertura_', '');
    return chave in coberturas ? (coberturas[chave] ? 1 : 0) : cotacao[campo];
  });

  db.prepare(`
    UPDATE cotacoes SET
      veiculo_placa = ?, veiculo_marca = ?, veiculo_modelo = ?,
      veiculo_ano_fabricacao = ?, veiculo_ano_modelo = ?, veiculo_zero_km = ?, veiculo_uso = ?,
      garagem = ?, cep_pernoite = ?,
      ${CAMPOS_COBERTURA.map((c) => `${c} = ?`).join(', ')},
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    veiculo.placa ?? cotacao.veiculo_placa,
    veiculo.marca ?? cotacao.veiculo_marca,
    veiculo.modelo ?? cotacao.veiculo_modelo,
    veiculo.anoFabricacao ?? cotacao.veiculo_ano_fabricacao,
    veiculo.anoModelo ?? cotacao.veiculo_ano_modelo,
    veiculo.zeroKm !== undefined ? (veiculo.zeroKm ? 1 : 0) : cotacao.veiculo_zero_km,
    veiculo.uso ?? cotacao.veiculo_uso,
    veiculo.garagem !== undefined ? (veiculo.garagem ? 1 : 0) : cotacao.garagem,
    veiculo.cepPernoite ?? cotacao.cep_pernoite,
    ...coberturaValores,
    req.params.id
  );

  registrarHistorico(req.params.id, req.user.id, 'atualizacao', 'Dados da cotação atualizados.');
  res.json(buscarCotacaoCompleta(req.params.id));
});

// PATCH /api/cotacoes/:id/status
router.patch(
  '/:id/status',
  [
    param('id').isInt(),
    body('status').isIn(['em_andamento', 'aguardando_seguradoras', 'concluida', 'expirada', 'cancelada']),
  ],
  validar,
  (req, res) => {
    const cotacao = db.prepare('SELECT * FROM cotacoes WHERE id = ?').get(req.params.id);
    if (!cotacao) return res.status(404).json({ erro: 'Cotação não encontrada.' });

    db.prepare(`UPDATE cotacoes SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(req.body.status, req.params.id);
    registrarHistorico(req.params.id, req.user.id, 'mudanca_status', `Status alterado para "${req.body.status}".`);

    res.json(buscarCotacaoCompleta(req.params.id));
  }
);

// DELETE /api/cotacoes/:id
router.delete('/:id', [param('id').isInt()], validar, (req, res) => {
  const cotacao = db.prepare('SELECT * FROM cotacoes WHERE id = ?').get(req.params.id);
  if (!cotacao) return res.status(404).json({ erro: 'Cotação não encontrada.' });

  db.prepare('DELETE FROM cotacoes WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// =========================================================================
// RESULTADOS POR SEGURADORA (tabela comparativa da cotação)
// =========================================================================

// POST /api/cotacoes/:id/resultados — adiciona/retorna o preço de uma seguradora
router.post(
  '/:id/resultados',
  [
    param('id').isInt(),
    body('seguradoraId').isInt().withMessage('Selecione uma seguradora.'),
    body('valorAnual').isFloat({ min: 0 }).withMessage('Informe o valor anual.'),
  ],
  validar,
  (req, res) => {
    const cotacao = db.prepare('SELECT * FROM cotacoes WHERE id = ?').get(req.params.id);
    if (!cotacao) return res.status(404).json({ erro: 'Cotação não encontrada.' });

    const seguradora = db.prepare('SELECT * FROM seguradoras WHERE id = ?').get(req.body.seguradoraId);
    if (!seguradora) return res.status(404).json({ erro: 'Seguradora não encontrada.' });

    const { plano, coberturaResumo, franquia, valorAnual, valorParcela, parcelas = 1, status = 'disponivel' } = req.body;

    const info = db.prepare(`
      INSERT INTO cotacao_resultados (cotacao_id, seguradora_id, plano, cobertura_resumo, franquia, valor_anual, valor_parcela, parcelas, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, req.body.seguradoraId, plano, coberturaResumo, franquia, valorAnual, valorParcela, parcelas, status);

    // Atualiza o "melhor valor" da cotação, se aplicável
    const melhor = db.prepare(`
      SELECT id, valor_anual FROM cotacao_resultados WHERE cotacao_id = ? AND status != 'indisponivel' ORDER BY valor_anual ASC LIMIT 1
    `).get(req.params.id);

    if (melhor) {
      db.prepare(`
        UPDATE cotacoes SET melhor_valor = ?, melhor_resultado_id = ?, updated_at = datetime('now') WHERE id = ?
      `).run(melhor.valor_anual, melhor.id, req.params.id);
    }

    registrarHistorico(req.params.id, req.user.id, 'resultado_adicionado', `Preço recebido de ${seguradora.nome}.`);

    res.status(201).json(buscarCotacaoCompleta(req.params.id));
  }
);

// PATCH /api/cotacoes/:id/resultados/:resultadoId/selecionar — marca o plano escolhido pelo cliente
router.patch(
  '/:id/resultados/:resultadoId/selecionar',
  [param('id').isInt(), param('resultadoId').isInt()],
  validar,
  (req, res) => {
    const resultado = db.prepare('SELECT * FROM cotacao_resultados WHERE id = ? AND cotacao_id = ?').get(req.params.resultadoId, req.params.id);
    if (!resultado) return res.status(404).json({ erro: 'Resultado não encontrado para esta cotação.' });

    const transacao = db.transaction(() => {
      db.prepare(`UPDATE cotacao_resultados SET status = 'disponivel' WHERE cotacao_id = ?`).run(req.params.id);
      db.prepare(`UPDATE cotacao_resultados SET status = 'selecionada' WHERE id = ?`).run(req.params.resultadoId);
      db.prepare(`UPDATE cotacoes SET status = 'concluida', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    });
    transacao();

    registrarHistorico(req.params.id, req.user.id, 'plano_selecionado', 'Cliente optou pelo plano apresentado.');
    res.json(buscarCotacaoCompleta(req.params.id));
  }
);

// DELETE /api/cotacoes/:id/resultados/:resultadoId
router.delete('/:id/resultados/:resultadoId', [param('id').isInt(), param('resultadoId').isInt()], validar, (req, res) => {
  const resultado = db.prepare('SELECT * FROM cotacao_resultados WHERE id = ? AND cotacao_id = ?').get(req.params.resultadoId, req.params.id);
  if (!resultado) return res.status(404).json({ erro: 'Resultado não encontrado para esta cotação.' });

  db.prepare('DELETE FROM cotacao_resultados WHERE id = ?').run(req.params.resultadoId);
  res.status(204).send();
});

module.exports = router;
