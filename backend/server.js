require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

require('./src/db'); // garante que o banco/tabelas sejam inicializados

const authRoutes = require('./src/routes/auth');
const clientesRoutes = require('./src/routes/clientes');
const seguradorasRoutes = require('./src/routes/seguradoras');
const usuariosRoutes = require('./src/routes/usuarios');
const cotacoesRoutes = require('./src/routes/cotacoes');
const dashboardRoutes = require('./src/routes/dashboard');
const relatoriosRoutes = require('./src/routes/relatorios');
const configuracoesRoutes = require('./src/routes/configuracoes');
const perfilRoutes = require('./src/routes/perfil');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN || '').split(',') }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', servico: 'Varginha Seguros API', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/seguradoras', seguradorasRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/cotacoes', cotacoesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/configuracoes', configuracoesRoutes);
app.use('/api/perfil', perfilRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

// Handler de erros genérico
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ erro: err.message || 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Varginha Seguros API rodando em http://localhost:${PORT}`);
});
