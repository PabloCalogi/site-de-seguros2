# Varginha Seguros — Backend / API

API REST em **Node.js + Express + SQLite** desenvolvida para servir o front-end
"Varginha Seguros - Dashboard & Sistema de Cotações" (dashboard, wizard de nova
cotação, clientes, seguradoras, usuários, histórico, relatórios, configurações
e perfil).

## 🚀 Tecnologias

* **Node.js** + **Express**
* **SQLite** via `better-sqlite3` (banco em arquivo, zero configuração)
* **JWT** (`jsonwebtoken`) para autenticação
* **bcryptjs** para hash de senhas
* **express-validator** para validação de entrada

## 📦 Instalação

```bash
cd backend
npm install
cp .env.example .env
npm run seed     # cria as tabelas e os dados iniciais
npm run dev       # ou "npm start" para produção
```

A API sobe em `http://localhost:3000` (porta configurável em `.env`).

### Usuário administrador padrão (criado pelo seed)

```
E-mail: admin@varginhaseguros.com.br
Senha:  admin123
```

> ⚠️ Troque essa senha e o `JWT_SECRET` do `.env` antes de ir para produção.

## 🗂️ Estrutura

```
backend/
├── server.js                 # ponto de entrada
├── .env.example
├── src/
│   ├── db/
│   │   ├── index.js          # conexão + criação das tabelas (schema)
│   │   └── seed.js           # dados iniciais (admin, seguradoras, cliente exemplo)
│   ├── middleware/
│   │   ├── auth.js           # autenticar() e autorizar(perfis...)
│   │   └── validate.js       # tratamento de erros do express-validator
│   └── routes/
│       ├── auth.js
│       ├── clientes.js
│       ├── seguradoras.js
│       ├── usuarios.js
│       ├── cotacoes.js
│       ├── dashboard.js
│       ├── relatorios.js
│       ├── configuracoes.js
│       └── perfil.js
```

## 🔐 Autenticação

Todas as rotas (exceto `/api/auth/*` e `/api/health`) exigem o header:

```
Authorization: Bearer <token>
```

O token é obtido em `POST /api/auth/login` e expira conforme `JWT_EXPIRES_IN`
(padrão 8h). Existem 3 perfis de usuário: `admin`, `gerente` e `corretor`,
usados para restringir ações sensíveis (gestão de usuários, exclusão de
seguradoras etc.).

## 📖 Endpoints

### Autenticação — `/api/auth`
| Método | Rota | Descrição |
|---|---|---|
| POST | `/login` | Autentica com `email` + `senha`, retorna `token` e `usuario` |
| POST | `/esqueci-senha` | Gera token de recuperação (tela "Recuperar Senha") |
| POST | `/redefinir-senha` | Define nova senha a partir do `token` recebido |
| GET | `/me` | Retorna o usuário autenticado |

### Clientes — `/api/clientes`
| Método | Rota | Descrição |
|---|---|---|
| GET | `/?busca=&page=&pageSize=` | Lista/pesquisa clientes (paginado) |
| GET | `/:id` | Detalhe do cliente + suas cotações |
| POST | `/` | Cria cliente |
| PUT | `/:id` | Atualiza cliente |
| DELETE | `/:id` | Remove cliente (bloqueado se houver cotações vinculadas) |

### Seguradoras — `/api/seguradoras`
| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Lista seguradoras |
| GET | `/:id` | Detalhe |
| POST | `/` | Cria (admin/gerente) |
| PUT | `/:id` | Atualiza (admin/gerente) |
| POST | `/:id/sincronizar` | Simula sincronização da integração |
| DELETE | `/:id` | Remove (admin) |

### Usuários — `/api/usuarios` (tela "Usuários")
| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Lista usuários (admin/gerente) |
| GET | `/:id` | Detalhe (admin/gerente) |
| POST | `/` | Cria usuário (admin) |
| PUT | `/:id` | Atualiza nome/e-mail/perfil/status (admin) |
| PATCH | `/:id/senha` | Redefine senha (admin ou o próprio usuário) |
| DELETE | `/:id` | Remove (admin) |

### Perfil — `/api/perfil` (tela "Perfil do Usuário", auto-serviço)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Dados do usuário logado |
| PUT | `/` | Atualiza nome/telefone/avatar |
| PATCH | `/senha` | Troca a própria senha (exige senha atual) |

### Cotações — `/api/cotacoes` (Wizard "Nova Cotação", "Cotações", "Histórico", "Detalhes")
| Método | Rota | Descrição |
|---|---|---|
| GET | `/?status=&clienteId=&busca=&page=&pageSize=` | Lista/histórico de cotações |
| GET | `/:id` | Detalhes completos (cliente, veículo, coberturas, resultados, linha do tempo) |
| POST | `/` | Cria a cotação (consolida as 4 etapas do wizard) — body abaixo |
| PUT | `/:id` | Atualiza dados do veículo/coberturas |
| PATCH | `/:id/status` | Altera status (`em_andamento`, `aguardando_seguradoras`, `concluida`, `expirada`, `cancelada`) |
| DELETE | `/:id` | Remove cotação |
| POST | `/:id/resultados` | Adiciona o preço/plano de uma seguradora à comparação |
| PATCH | `/:id/resultados/:resultadoId/selecionar` | Marca o plano escolhido pelo cliente (fecha a cotação) |
| DELETE | `/:id/resultados/:resultadoId` | Remove um resultado |

**Body de `POST /api/cotacoes`:**
```json
{
  "clienteId": 1,
  "veiculo": {
    "placa": "ABC1D23",
    "marca": "Fiat",
    "modelo": "Argo",
    "anoFabricacao": 2022,
    "anoModelo": 2023,
    "zeroKm": false,
    "uso": "particular",
    "garagem": true,
    "cepPernoite": "37000-000"
  },
  "coberturas": {
    "compreensiva": true,
    "incendio": false,
    "roubo": true,
    "terceiros": true,
    "vidros": false,
    "assistencia": true,
    "carro_reserva": false,
    "morais": false
  }
}
```

### Dashboard — `/api/dashboard`
Retorna KPIs (total de cotações, clientes, taxa de conversão, ticket médio),
séries para gráficos (cotações por mês/status, desempenho por seguradora) e
as últimas cotações — tudo que a tela `Dashboard.html` (Chart.js) precisa.

### Relatórios — `/api/relatorios`
| Método | Rota | Descrição |
|---|---|---|
| GET | `/cotacoes?de=&ate=&status=&seguradoraId=` | Relatório filtrado de cotações |
| GET | `/seguradoras` | Desempenho comparativo entre seguradoras |
| GET | `/clientes` | Ranking de clientes por volume de cotações |

### Configurações — `/api/configuracoes`
| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Retorna as configurações da corretora (chave: valor) |
| PUT | `/` | Atualiza configurações (admin) |

## 🧱 Modelo de dados (resumo)

* **usuarios** — equipe da corretora (login, perfil, status)
* **clientes** — pessoas físicas/jurídicas atendidas
* **seguradoras** — parceiras integradas ao multicotador
* **cotacoes** — cabeçalho gerado pelo wizard (cliente + veículo + coberturas + status)
* **cotacao_resultados** — preço/plano retornado por cada seguradora para a cotação
* **cotacao_historico** — linha do tempo de eventos de cada cotação
* **configuracoes** — dados da corretora (chave/valor)

## 🔧 Variáveis de ambiente (`.env`)

```
PORT=3000
NODE_ENV=development
JWT_SECRET=troque-este-segredo-em-producao
JWT_EXPIRES_IN=8h
DB_PATH=./data/varginha_seguros.db
CORS_ORIGIN=*
```

## 🔗 Conectando ao front-end

O front-end (pasta `Site-de-Seguros`) é hoje estático (HTML/CSS/JS puro, sem
chamadas fetch). Para integrá-lo:

1. Sirva os arquivos `.html` normalmente (ex: Live Server, Nginx, ou o próprio
   Express com `express.static`).
2. Em cada tela, adicione chamadas `fetch('http://localhost:3000/api/...')`
   enviando o header `Authorization: Bearer <token>` (token salvo no
   `localStorage` após o login).
3. Habilite `CORS_ORIGIN` no `.env` com a origem do front (ex:
   `http://localhost:5500`).

Desenvolvido para o projeto Varginha Seguros — Pablo Henrique Silva Calogi.
