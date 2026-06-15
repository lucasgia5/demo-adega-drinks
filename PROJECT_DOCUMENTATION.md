# PROJECT DOCUMENTATION — Adega Delivery (White Label)

> Documentação técnica completa do projeto. Escrita para que **outro desenvolvedor** (ou uma IA como Codex) consiga continuar o desenvolvimento **sem contexto prévio**.

Última atualização: 2026-02

---

## Índice

1. [Visão Geral do Projeto](#1-visão-geral-do-projeto)
2. [Estrutura de Pastas](#2-estrutura-de-pastas)
3. [Frontend](#3-frontend)
4. [Backend](#4-backend)
5. [Banco de Dados](#5-banco-de-dados)
6. [Fluxo de Autenticação](#6-fluxo-de-autenticação)
7. [Usuários e Permissões](#7-usuários-e-permissões)
8. [Funcionalidades Implementadas](#8-funcionalidades-implementadas)
9. [Fluxo Completo do Pedido](#9-fluxo-completo-do-pedido)
10. [Configurações White Label](#10-configurações-white-label)
11. [Variáveis de Ambiente](#11-variáveis-de-ambiente)
12. [Dependências](#12-dependências)
13. [Guia de Deploy](#13-guia-de-deploy)
14. [Melhorias Futuras](#14-melhorias-futuras)

---

## 1. Visão Geral do Projeto

### 1.1. Objetivo

Aplicação web **white-label de delivery** focada em **adegas**, mas estruturada de forma genérica para ser reutilizada em qualquer pequeno comércio (uma loja por instalação — **não é multi-tenant**).

O fluxo principal converte um carrinho em uma **mensagem de WhatsApp pré-preenchida** que abre direto no número da loja, com pedido salvo no banco para gestão posterior pelo administrador.

### 1.2. Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Tailwind CSS + shadcn/ui |
| Backend | FastAPI (Python 3.11) + Motor (driver MongoDB async) |
| Banco | MongoDB |
| Auth | JWT customizado (PyJWT + bcrypt), via httpOnly cookies + Bearer token |
| Build/dev | CRA (react-scripts) no frontend, Uvicorn no backend |
| Process manager | supervisord (no ambiente Emergent) |

### 1.3. Arquitetura geral

```
┌─────────────────────┐         ┌──────────────────┐         ┌──────────┐
│  React (Storefront  │ ──HTTP─▶│  FastAPI (8001)  │ ──BSON─▶│ MongoDB  │
│  + Painel Admin)    │ ◀──JSON│  /api/*          │ ◀───────│          │
└─────────────────────┘         └──────────────────┘         └──────────┘
        ▲                                │
        │ window.open(wa.me/...)         │
        └─── WhatsApp (cliente abre)     │
                                         ▼
                                   store_config.py (white-label)
```

- O frontend faz todas as chamadas através de `REACT_APP_BACKEND_URL` + prefixo `/api`. A rede Kubernetes/Ingress encaminha tudo que começa com `/api` para o backend na porta 8001.
- Auth: o backend devolve `access_token` (e seta cookies `access_token`/`refresh_token` httpOnly). O frontend persiste o token também em `localStorage` para suportar ambientes onde cookies cross-site são restritos.
- WhatsApp não é uma integração de API — é apenas a abertura do `https://wa.me/<numero>?text=<mensagem>` no navegador do cliente.

### 1.4. Tecnologias do Frontend

- **React 19** (CRA — `react-scripts`)
- **Tailwind CSS 3** + `tailwindcss-animate`
- **shadcn/ui** — biblioteca de componentes baseada em Radix UI (botões, dialog, sheet, select, switch, etc.) localizada em `frontend/src/components/ui/`
- **React Router 7** — roteamento client-side
- **Axios** — cliente HTTP
- **lucide-react** — ícones
- **sonner** — toasts
- Fontes: **Cormorant Garamond** (display/serifa) + **Outfit** (sans), carregadas via Google Fonts no `public/index.html`

### 1.5. Tecnologias do Backend

- **FastAPI** + **Uvicorn**
- **Motor** (driver MongoDB assíncrono baseado em PyMongo)
- **Pydantic v2** — validação e serialização
- **PyJWT** — emissão/verificação de tokens
- **bcrypt** — hash de senha
- **python-dotenv** — carrega `.env`

### 1.6. Banco de Dados

**MongoDB**. Nome do banco vem de `DB_NAME` (`adega_delivery` por padrão). Identificadores: usamos **UUID v4 string** em todos os documentos (campo `id`), nunca expomos `_id` ObjectId — o backend faz `find({}, {"_id": 0})` em toda leitura.

Coleções: `users`, `categories`, `products`, `orders`, `delivery_areas`.

---

## 2. Estrutura de Pastas

```
/app/
├── backend/
│   ├── server.py              # Aplicação FastAPI completa (auth, CRUD, orders, stats)
│   ├── store_config.py        # White-label config (nome, cores, WhatsApp, Pix, banner)
│   ├── requirements.txt       # Dependências Python
│   └── .env                   # Variáveis de ambiente do backend
│
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js     # Tema (cores brand, fontes, animações)
│   ├── postcss.config.js
│   ├── jsconfig.json          # Alias '@/...' -> 'src/...'
│   ├── public/
│   │   └── index.html         # Importa Google Fonts + título
│   └── src/
│       ├── index.js           # Entry point
│       ├── App.js             # Rotas + providers globais
│       ├── App.css
│       ├── index.css          # Tailwind base + CSS variables (tema)
│       ├── lib/
│       │   ├── api.js         # axios + helpers (brl, formatApiErrorDetail)
│       │   └── utils.js       # cn() do shadcn
│       ├── context/
│       │   ├── AuthContext.jsx        # login/register/logout, user state
│       │   ├── CartContext.jsx        # carrinho (localStorage)
│       │   └── StoreConfigContext.jsx # busca /api/config e provê globalmente
│       ├── hooks/
│       │   └── use-toast.js
│       ├── components/
│       │   ├── ui/                # shadcn (NÃO MODIFICAR sem necessidade)
│       │   ├── Header.jsx         # cabeçalho do storefront
│       │   ├── ProductCard.jsx    # card de produto (com promo)
│       │   ├── CartDrawer.jsx     # gaveta do carrinho
│       │   ├── AdminLayout.jsx    # layout do painel admin (sidebar + header)
│       │   └── ProtectedRoute.jsx # guard de rotas (cliente / admin)
│       └── pages/
│           ├── Storefront.jsx
│           ├── ProductDetail.jsx
│           ├── Checkout.jsx
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── Account.jsx
│           ├── AdminLogin.jsx
│           └── admin/
│               ├── Dashboard.jsx
│               ├── Products.jsx
│               ├── Categories.jsx
│               ├── Orders.jsx
│               └── DeliveryAreas.jsx
│
├── memory/
│   ├── PRD.md                 # Backlog vivo + histórico de iterações
│   └── test_credentials.md    # Credenciais de teste (admin)
│
├── test_reports/              # JSONs gerados pelo testing agent
└── design_guidelines.json     # Saída do design agent (referência visual)
```

### 2.1. Responsabilidade de cada pasta

| Pasta | Responsabilidade |
|---|---|
| `backend/` | Toda a API FastAPI. Mantemos o backend **enxuto e em um único `server.py`** — se um dia ficar grande, dividir em `routers/`, `models/`, `services/`. |
| `backend/store_config.py` | Dicionário **único** com o branding white-label. Editar aqui para re-brandear toda a aplicação. |
| `frontend/src/lib/` | Utilidades JS puras (axios instance, formatters). |
| `frontend/src/context/` | Estado global via **React Context** (Auth, Cart, StoreConfig). |
| `frontend/src/components/ui/` | Componentes **shadcn/ui** (Radix wrappers). Não devem ser editados — se precisar de variação, criar componente próprio que os consome. |
| `frontend/src/components/` | Componentes customizados, geralmente compostos sobre `ui/`. |
| `frontend/src/pages/` | Páginas mapeadas em rotas. As do admin ficam em `pages/admin/`. |
| `memory/` | Documentos auxiliares lidos por agentes (testing agent, fork agent). |
| `test_reports/` | Saídas dos agentes de teste — não comitar manualmente. |

### 2.2. Convenção de imports

Existe o alias `@/` apontando para `frontend/src/`. Exemplo:

```js
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
```

---

## 3. Frontend

### 3.1. Rotas

Definidas em `frontend/src/App.js` (React Router).

| Rota | Componente | Acesso |
|---|---|---|
| `/` | `Storefront` | Público |
| `/produto/:id` | `ProductDetail` | Público |
| `/checkout` | `Checkout` | Público |
| `/login` | `Login` | Público |
| `/cadastro` | `Register` | Público |
| `/conta` | `Account` | Cliente autenticado |
| `/admin/login` | `AdminLogin` | Público |
| `/admin` | `admin/Dashboard` | Admin |
| `/admin/produtos` | `admin/Products` | Admin |
| `/admin/categorias` | `admin/Categories` | Admin |
| `/admin/pedidos` | `admin/Orders` | Admin |
| `/admin/areas` | `admin/DeliveryAreas` | Admin |

Guard de rota: `ProtectedRoute` aceita prop `requireAdmin`. Sem token → redireciona para `/login` (ou `/admin/login` se for admin). Token de customer tentando `/admin/*` → redireciona para `/`.

### 3.2. Páginas

#### `Storefront.jsx`
- Faz `GET /api/categories` e `GET /api/products` em paralelo no mount.
- Mantém estado local: `activeCat` (id da categoria) e `search` (string).
- Filtra os produtos em memória (`useMemo`) — não dispara nova request por filtro.
- Renderiza hero com banner (vindo de `STORE_CONFIG.banner_url`), chips de categoria horizontais, grade de `ProductCard`.

#### `ProductDetail.jsx`
- `GET /api/products/:id`. Permite escolher quantidade e adicionar ao carrinho.

#### `Checkout.jsx`
- Lê o carrinho do `CartContext` e exibe Resumo (Subtotal, Taxa de entrega, Total).
- Busca áreas ativas em `GET /api/delivery-areas`. Cliente deve escolher uma.
- Bloqueia confirmar se subtotal < `min_order` da área selecionada (mostra `min-order-warning`).
- No submit:
  1. `POST /api/orders` com `{ customer_name, customer_phone, customer_address, delivery_area_id, payment_method, items, observations }`.
  2. Constrói mensagem WhatsApp via `formatWhatsAppMessage(order)`.
  3. `window.open(\`https://wa.me/${number}?text=${encodeURIComponent(msg)}\`)`.
  4. Limpa carrinho (`clear()`), toast e redireciona para `/`.

#### `Login.jsx` / `Register.jsx`
- Forms controlados. Chamam `useAuth().login()` / `register()`. Em sucesso, redirecionam para `/` (ou `/admin` se for admin).

#### `Account.jsx`
- `GET /api/orders/mine`. Lista os pedidos do cliente logado com status, itens, subtotal, taxa e total.

#### `AdminLogin.jsx`
- Mesmo fluxo do `Login.jsx`, mas exibe erro se o usuário não tiver `role === "admin"` e redireciona para `/admin`.

#### `admin/Dashboard.jsx`
- `GET /api/admin/stats`. 4 cards (Pedidos, Produtos, Categorias, Receita) + breakdown por status.

#### `admin/Products.jsx`
- Tabela com produtos. Dialog (modal shadcn) para criar/editar com toggle "Disponível", toggle "Ativar promoção" que revela campo de "Preço promocional".

#### `admin/Categories.jsx`
- Lista simples com create/edit/delete em dialog. Backend rejeita delete se houver produtos vinculados (HTTP 400).

#### `admin/Orders.jsx`
- Lista de pedidos com cabeçalho clicável (expande detalhes). Mostra contato, endereço, **região**, itens, **subtotal / taxa / total**, observações, pagamento, e Select para alterar status.
- Filtro por status (Select no header).

#### `admin/DeliveryAreas.jsx`
- Tabela com bairros: nome, taxa, pedido mínimo, switch ativo. Dialog para criar/editar.

### 3.3. Componentes principais

| Componente | Função |
|---|---|
| `Header.jsx` | Header sticky do storefront com logo (vem do StoreConfig), busca live, menu usuário (dropdown shadcn) e botão de carrinho com badge de contagem. |
| `ProductCard.jsx` | Card com imagem, nome, preço (riscado + promocional se `promo_active`) e botão de adicionar. |
| `CartDrawer.jsx` | Sheet (lateral) shadcn com itens, +/-, remoção, total e botão de checkout. |
| `AdminLayout.jsx` | Sidebar dark com navegação do painel + header com título e ações; nav mobile horizontal. |
| `ProtectedRoute.jsx` | Guard de rota baseado em `useAuth()`. |

### 3.4. Fluxos de usuário

**Cliente (sem conta):**
`/` → adicionar produtos → CartDrawer → `/checkout` → preencher dados → escolher bairro → escolher pagamento → confirmar → abre WhatsApp.

**Cliente (com conta):**
Mesmo fluxo + opção de visitar `/conta` com histórico.

**Admin:**
`/admin/login` → `/admin` (dashboard) → gerir produtos/categorias/áreas → ver pedidos em `/admin/pedidos` → alterar status.

### 3.5. Gerenciamento de estado

| Estado | Onde mora | Persistência |
|---|---|---|
| Usuário autenticado | `AuthContext` | `localStorage.auth_token` + cookie httpOnly |
| Carrinho | `CartContext` | `localStorage.adega_cart` (JSON) |
| Config white-label | `StoreConfigContext` | Em memória (carregado de `/api/config` no boot) |
| Catálogo, pedidos, etc. | Estado local de cada página (`useState`) | Não persistido (refetch ao montar) |

Não usamos Redux / Zustand / React Query — para o escopo atual, **Context + useState + Axios** é suficiente e mantém o código simples.

### 3.6. Bibliotecas

Ver `frontend/package.json`. Principais:

```
react 19, react-router-dom 7, axios, tailwindcss 3 + tailwindcss-animate,
@radix-ui/* (consumido via shadcn/ui), class-variance-authority, clsx, tailwind-merge,
lucide-react, sonner, date-fns, react-hook-form, zod, embla-carousel-react.
```

### 3.7. Comunicação com o backend

Tudo passa por `frontend/src/lib/api.js`:

```js
import axios from "axios";
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL; // p.ex. https://meusite.com
export const API = `${BACKEND_URL}/api`;
const api = axios.create({ baseURL: API, withCredentials: true });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export default api;
```

- `withCredentials: true` permite cookies httpOnly.
- O interceptor sempre injeta `Authorization: Bearer <token>` quando há token salvo — funciona em paralelo aos cookies.

---

## 4. Backend

### 4.1. Estrutura

Todo o backend está em **um único arquivo** `backend/server.py`, organizado em seções comentadas:

```
Setup / DB / FastAPI app
Auth helpers (hash, JWT, dependencies)
Models (Pydantic)
Routes — Auth
Routes — Store config (público)
Routes — Categories
Routes — Products
Routes — Orders
Routes — Delivery Areas
Routes — Admin (stats)
Startup hook (índices + seed admin/categorias/produtos/áreas)
CORS + include_router
```

Quando o backend crescer, sugerimos partir em `app/routers/{auth,products,orders,...}.py` e `app/models.py`. Hoje, monolítico = menos overhead.

### 4.2. Middlewares e helpers

#### `get_current_user(request)`
Dependency do FastAPI. Tenta ler token de **(1)** cookie `access_token` ou **(2)** header `Authorization: Bearer ...`. Decodifica com PyJWT (HS256), busca usuário no Mongo por `id`, remove `password_hash`. Lança `401` se token ausente/expirado/inválido ou usuário não encontrado.

#### `require_admin(user = Depends(get_current_user))`
Lança `403` se `user.role != "admin"`.

#### `hash_password(plain)` / `verify_password(plain, hashed)`
bcrypt com salt aleatório.

#### `create_access_token(user_id, email, role)` / `create_refresh_token(user_id)`
JWT HS256. Access: 1 dia. Refresh: 7 dias (gerado mas ainda **não usado** num endpoint de refresh — fica como melhoria).

#### `set_auth_cookies(response, access, refresh)`
Seta cookies `httponly=True`, `secure=True`, `samesite="none"`, path `/`.

### 4.3. CORS

```python
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> ⚠️ **Aviso de segurança**: aceitar qualquer origem com `allow_credentials=True` é amplo. Em produção, restringir para o domínio real (`FRONTEND_URL`). Ver [Melhorias Futuras](#14-melhorias-futuras).

### 4.4. Validações

- Pydantic v2 valida todos os payloads automaticamente. Erros retornam **422** com detalhes.
- Regras adicionais aplicadas no handler (ex: pedido com itens vazio → **400**, área de entrega inativa → **400**, abaixo do mínimo → **400** com mensagem amigável).
- Senha mínima de 6 chars (`Field(min_length=6)` em `RegisterIn`).
- `payment_method` validado por `Literal["pix","dinheiro","cartao"]`.
- `status` de pedido validado por `Literal["recebido","em_preparo","saiu_entrega","entregue","cancelado"]`.

### 4.5. Endpoints

Todos sob o prefixo `/api`. Tabela rápida:

#### 4.5.1. Auth

| Método | URL | Auth | Descrição |
|---|---|---|---|
| POST | `/api/auth/register` | — | Cria cliente. Retorna `{ user, access_token }`. Seta cookies. |
| POST | `/api/auth/login` | — | Autentica. Retorna `{ user, access_token }`. |
| POST | `/api/auth/logout` | — | Limpa cookies. |
| GET | `/api/auth/me` | Bearer | Retorna usuário corrente. |

`RegisterIn`:
```json
{ "name": "João", "email": "joao@x.com", "password": "secret1", "phone": "11999..." }
```
Erros: `409` se e-mail já existe.

`LoginIn`:
```json
{ "email": "admin@adega.com", "password": "admin123" }
```
Erros: `401` credenciais inválidas.

Resposta de sucesso (login/register):
```json
{
  "user": { "id":"uuid", "name":"...", "email":"...", "role":"customer|admin", "phone":"", "addresses":[], "created_at":"..." },
  "access_token": "eyJhbGciOi..."
}
```

#### 4.5.2. Store config

| Método | URL | Descrição |
|---|---|---|
| GET | `/api/config` | Retorna o dict `STORE_CONFIG` (white-label). |

#### 4.5.3. Categories

| Método | URL | Auth | Descrição |
|---|---|---|---|
| GET | `/api/categories` | — | Lista todas. |
| POST | `/api/categories` | Admin | Cria. |
| PUT | `/api/categories/{id}` | Admin | Atualiza. |
| DELETE | `/api/categories/{id}` | Admin | Remove. Bloqueia se houver produtos vinculados (400). |

`CategoryIn`: `{ "name": str, "description"?: str, "icon"?: str }`

#### 4.5.4. Products

| Método | URL | Auth | Descrição |
|---|---|---|---|
| GET | `/api/products?category_id&search` | — | Lista com filtros opcionais. `search` faz regex case-insensitive no nome. |
| GET | `/api/products/{id}` | — | Detalhe. |
| POST | `/api/products` | Admin | Cria. |
| PUT | `/api/products/{id}` | Admin | Atualiza. |
| DELETE | `/api/products/{id}` | Admin | Remove. |

`ProductIn`:
```json
{
  "name": "Cabernet Sauvignon",
  "description": "...",
  "image_url": "https://...",
  "price": 89.90,
  "category_id": "<uuid>",
  "available": true,
  "promo_active": true,
  "promo_price": 64.90
}
```

#### 4.5.5. Orders

| Método | URL | Auth | Descrição |
|---|---|---|---|
| POST | `/api/orders` | Opcional | Cria pedido (guest ou cliente logado). |
| GET | `/api/orders` | Admin | Lista todos, ordem decrescente. |
| GET | `/api/orders/mine` | Cliente | Lista pedidos do usuário logado. |
| PATCH | `/api/orders/{id}/status` | Admin | Atualiza status. |

`OrderIn`:
```json
{
  "customer_name": "João",
  "customer_phone": "11999999999",
  "customer_address": "Rua X, 123",
  "payment_method": "pix",
  "delivery_area_id": "<uuid|null>",
  "observations": "deixar com porteiro",
  "items": [
    { "product_id": "<uuid>", "name": "Malbec", "quantity": 2, "unit_price": 72.5 }
  ]
}
```

O backend calcula: `subtotal = sum(unit_price * qty)`, `total = subtotal + delivery_fee`. Status inicial = `"recebido"`.

`OrderStatusIn`: `{ "status": "recebido"|"em_preparo"|"saiu_entrega"|"entregue"|"cancelado" }`

Erros do POST:
- `400` carrinho vazio
- `400` área inválida / inativa
- `400` pedido mínimo (mensagem inclui o valor mínimo)

#### 4.5.6. Delivery Areas

| Método | URL | Auth | Descrição |
|---|---|---|---|
| GET | `/api/delivery-areas` | — | Lista **apenas ativas**. Usado no checkout. |
| GET | `/api/admin/delivery-areas` | Admin | Lista todas (ativas + inativas). |
| POST | `/api/admin/delivery-areas` | Admin | Cria. |
| PUT | `/api/admin/delivery-areas/{id}` | Admin | Atualiza. |
| DELETE | `/api/admin/delivery-areas/{id}` | Admin | Remove. |

`DeliveryAreaIn`: `{ "name": str, "fee": float, "min_order"?: float, "active": bool }`

#### 4.5.7. Admin / Stats

| Método | URL | Auth | Descrição |
|---|---|---|---|
| GET | `/api/admin/stats` | Admin | Métricas para dashboard. |

Resposta:
```json
{
  "total_orders": 47,
  "total_products": 11,
  "total_categories": 5,
  "revenue": 3210.50,
  "orders_by_status": { "recebido": 5, "em_preparo": 2, "entregue": 40 }
}
```

### 4.6. "Controllers / Services / Models"

Hoje, em arquivo único:
- **Models** = classes Pydantic (`RegisterIn`, `ProductIn`, `OrderIn`, …).
- **Controllers** = funções decoradas com `@api_router.get/post/...`.
- **Services** = funções utilitárias (`compute_subtotal`, `hash_password`, `create_access_token`).

Se o backend crescer, mover para:
```
backend/app/
  models/      # Pydantic + classes auxiliares
  routers/     # Endpoints por domínio
  services/    # Lógica de negócio reusável
  deps.py      # get_current_user, require_admin
  db.py        # client + db
  main.py
```

---

## 5. Banco de Dados

DB: definido por `DB_NAME` (default `adega_delivery`).
Driver: **Motor (async)**.
Estratégia de ID: **UUID v4 string** no campo `id`. Nunca retornamos `_id` ObjectId.

### 5.1. Coleções

| Coleção | Finalidade |
|---|---|
| `users` | Usuários (clientes + admins) |
| `categories` | Categorias dos produtos |
| `products` | Produtos do catálogo |
| `orders` | Pedidos realizados |
| `delivery_areas` | Bairros/regiões com taxa de entrega |

### 5.2. `users`

| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `id` | string (UUID) | sim | PK lógica |
| `name` | string | sim | |
| `email` | string | sim | **único** (índice unique) |
| `password_hash` | string | sim | bcrypt; **nunca retornado pela API** |
| `phone` | string | não | |
| `role` | string | sim | `"customer"` ou `"admin"` |
| `addresses` | array | sim | Reservado (lista vazia hoje) |
| `created_at` | string (ISO8601) | sim | |

Exemplo:
```json
{
  "id": "a1b2c3...",
  "name": "Administrador",
  "email": "admin@adega.com",
  "password_hash": "$2b$12$...",
  "phone": "",
  "role": "admin",
  "addresses": [],
  "created_at": "2026-02-15T14:00:00+00:00"
}
```

Índices: `email` unique.

### 5.3. `categories`

| Campo | Tipo |
|---|---|
| `id` | string (UUID) |
| `name` | string |
| `description` | string (pode ser "") |
| `icon` | string (pode ser "") |
| `created_at` | ISO string |

Exemplo:
```json
{ "id": "cat-uuid", "name": "Vinhos Tintos", "description": "", "icon": "wine", "created_at": "2026-..." }
```

### 5.4. `products`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string (UUID) | |
| `name` | string | |
| `description` | string | |
| `image_url` | string | URL externa |
| `price` | float | preço cheio |
| `category_id` | string (UUID) | **FK lógica** → `categories.id` |
| `available` | bool | se aparece para o cliente |
| `promo_active` | bool | |
| `promo_price` | float \| null | obrigatório se `promo_active` |
| `created_at` | ISO string | |

Exemplo:
```json
{
  "id":"p-uuid",
  "name":"Cabernet Sauvignon Reserva",
  "description":"Vinho tinto encorpado...",
  "image_url":"https://images.unsplash.com/...",
  "price": 89.90,
  "category_id":"cat-uuid",
  "available": true,
  "promo_active": true,
  "promo_price": 64.90,
  "created_at":"2026-..."
}
```

Índices: `category_id` (para filtros).

### 5.5. `orders`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string (UUID) | |
| `customer_name` | string | |
| `customer_phone` | string | |
| `customer_address` | string | |
| `payment_method` | string | `pix` / `dinheiro` / `cartao` |
| `items` | array<object> | `{ product_id, name, quantity, unit_price }` |
| `observations` | string | |
| `subtotal` | float | soma dos itens |
| `delivery_area_id` | string \| null | FK lógica para `delivery_areas.id` |
| `delivery_area_name` | string | snapshot do nome no momento do pedido |
| `delivery_fee` | float | snapshot da taxa |
| `total` | float | `subtotal + delivery_fee` |
| `status` | string | `recebido` (default) → ... → `entregue`/`cancelado` |
| `user_id` | string \| null | se logado, FK para `users.id` |
| `created_at` | ISO string | |

Exemplo:
```json
{
  "id": "ord-uuid",
  "customer_name": "João",
  "customer_phone": "11999999999",
  "customer_address": "Rua A, 100",
  "payment_method": "pix",
  "items": [
    { "product_id": "p-uuid", "name": "Malbec Argentino", "quantity": 2, "unit_price": 72.5 }
  ],
  "observations": "Tocar interfone 2x",
  "subtotal": 145.0,
  "delivery_area_id": "area-uuid",
  "delivery_area_name": "Jardins",
  "delivery_fee": 12.0,
  "total": 157.0,
  "status": "recebido",
  "user_id": null,
  "created_at": "2026-02-15T15:00:00+00:00"
}
```

Índices: `created_at`.

### 5.6. `delivery_areas`

| Campo | Tipo |
|---|---|
| `id` | string (UUID) |
| `name` | string |
| `fee` | float |
| `min_order` | float \| null |
| `active` | bool |
| `created_at` | ISO string |

Exemplo:
```json
{ "id":"a-uuid", "name":"Jardins", "fee":12.0, "min_order":50.0, "active":true, "created_at":"..." }
```

Índices: `name`.

### 5.7. Relacionamentos (lógicos)

```
users 1───* orders   (orders.user_id)
categories 1───* products  (products.category_id)
delivery_areas 1───* orders (orders.delivery_area_id)
```

Não há foreign keys reais — o app valida no nível de aplicação.

---

## 6. Fluxo de Autenticação

### 6.1. Cadastro (`POST /api/auth/register`)

1. Cliente envia `{ name, email, password, phone? }`.
2. Backend lowercase + trim do email.
3. Se já existe em `users.email`, retorna **409**.
4. `hash_password()` com bcrypt.
5. Cria documento com `role:"customer"`, UUID id, `created_at`.
6. Emite `access_token` (1 dia) e `refresh_token` (7 dias).
7. `set_auth_cookies(...)` + retorna `{ user, access_token }`.

### 6.2. Login (`POST /api/auth/login`)

1. Recebe `{ email, password }`.
2. `find_one({email})`. Se não existe ou `verify_password` falha → **401** "E-mail ou senha incorretos".
3. Gera tokens, seta cookies, devolve user + access_token.

### 6.3. JWT

- Algoritmo: **HS256**, segredo em `JWT_SECRET`.
- Access token payload: `{ sub: user_id, email, role, type:"access", exp }`. Expira em 24h.
- Refresh token payload: `{ sub: user_id, type:"refresh", exp }`. Expira em 7 dias. *(Atualmente ainda não há endpoint que consuma o refresh — preparado para uma melhoria futura.)*
- `get_current_user` aceita token em cookie **ou** header `Authorization: Bearer ...` (frontend usa ambos).

### 6.4. Logout (`POST /api/auth/logout`)

Backend apaga os cookies. O frontend remove o `auth_token` do `localStorage` e zera o estado do `AuthContext`.

### 6.5. Proteção de rotas privadas

**Backend:**
```python
@api_router.get("/orders/mine")
async def list_my_orders(user: dict = Depends(get_current_user)):
    ...
```
Sem token válido → **401**.

**Frontend:**
```jsx
<Route path="/conta" element={<ProtectedRoute><Account/></ProtectedRoute>} />
```
Sem `user` → redireciona para `/login`.

### 6.6. Proteção de rotas administrativas

**Backend:**
```python
@api_router.post("/products")
async def create_product(payload: ProductIn, _: dict = Depends(require_admin)):
    ...
```
Token de customer → **403**.

**Frontend:**
```jsx
<Route path="/admin" element={<ProtectedRoute requireAdmin><Dashboard/></ProtectedRoute>} />
```
Sem user → vai para `/admin/login`. User com `role !== "admin"` → vai para `/`.

---

## 7. Usuários e Permissões

### 7.1. Roles

| Role | Como é criado | Acesso |
|---|---|---|
| `customer` | Cadastro via `/api/auth/register` ou checkout como visitante (sem conta) | Catálogo, carrinho, checkout, seus próprios pedidos (`/conta`). |
| `admin` | **Semeado no startup** com `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Não é possível criar admin pelo frontend. | Tudo do customer + todas as rotas `/admin/*` + todos endpoints `/api/admin/*` + escrita em produtos/categorias/áreas + alteração de status de pedidos. |

### 7.2. Visitor (sem login)

Não é uma role armazenada — é a ausência de token. Pode:
- Navegar pelo catálogo.
- Adicionar ao carrinho (persistido em `localStorage`).
- Finalizar pedido informando nome/telefone/endereço (`order.user_id = null`).

Não pode:
- Ver `/conta`.
- Acessar admin.

### 7.3. Tabela de permissões

| Ação | Visitor | Customer | Admin |
|---|:---:|:---:|:---:|
| Ver produtos / categorias / config | ✅ | ✅ | ✅ |
| Criar pedido | ✅ | ✅ | ✅ |
| Ver pedidos próprios | — | ✅ | ✅ (também) |
| Ver TODOS pedidos | — | — | ✅ |
| CRUD produtos / categorias / áreas | — | — | ✅ |
| Alterar status pedido | — | — | ✅ |
| Dashboard / Stats | — | — | ✅ |

---

## 8. Funcionalidades Implementadas

| # | Funcionalidade | Resumo |
|---|---|---|
| 1 | Cadastro de cliente | Email + senha + telefone via `/cadastro`. JWT emitido na hora. |
| 2 | Login cliente / admin | Mesma rota backend; admin entra por `/admin/login`. |
| 3 | Catálogo | Storefront `/` com hero, filtro por categoria e busca live. |
| 4 | Detalhes do produto | `/produto/:id` com imagem grande, quantidade e CTA. |
| 5 | Carrinho | Sheet lateral; persiste em `localStorage`; soma com preço promocional quando ativo. |
| 6 | Promoções | Toggle no produto: cliente vê preço antigo riscado + preço promocional em destaque. |
| 7 | Categorias | CRUD admin; chips no storefront. |
| 8 | Pedidos | Cliente preenche dados + escolhe pagamento (Pix, dinheiro, cartão) + bairro. |
| 9 | Taxa de entrega por bairro | Admin cadastra áreas com taxa, pedido mínimo e ativo/inativo. |
| 10 | Mensagem WhatsApp | `wa.me/<numero>?text=...` com pedido formatado (subtotal/taxa/total/região). |
| 11 | Histórico do cliente | `/conta` mostra todos os pedidos do usuário logado. |
| 12 | Dashboard admin | Total de pedidos, produtos, categorias, receita, breakdown por status. |
| 13 | Gestão de pedidos | Lista expandível; troca de status pelo Select. |
| 14 | White label | Centralizado em `backend/store_config.py`. Cores, logo, banner, WhatsApp, Pix. |

---

## 9. Fluxo Completo do Pedido

1. **Cliente abre `/`** → frontend chama `/api/config`, `/api/categories`, `/api/products`. Renderiza hero, chips, grid.
2. **Filtra/pesquisa** → filtragem em memória (sem novo request).
3. **Clica em um produto** → `/produto/:id` → carrega detalhe e permite escolher quantidade.
4. **"Adicionar ao carrinho"** → `CartContext.add(product, qty)` calcula `unit_price` efetivo (`promo_price` se ativo, senão `price`) e persiste no `localStorage`. Abre o `CartDrawer`.
5. **Carrinho** → cliente ajusta quantidades / remove itens. Total recalculado em tempo real.
6. **"Finalizar"** → navega para `/checkout`. Frontend chama `/api/delivery-areas` para popular as opções de bairro.
7. **Cliente preenche** nome, telefone, endereço, **bairro/região**, observações e seleciona forma de pagamento. Se selecionar bairro abaixo do mínimo, vê warning e botão fica desabilitado.
8. **"Confirmar e enviar via WhatsApp"** → `POST /api/orders`. Backend:
   - Lê token opcional (para popular `user_id`).
   - Valida itens, área, mínimo.
   - Salva documento com `status="recebido"`, `subtotal`, `delivery_fee`, `total`.
   - Retorna o pedido completo.
9. **Frontend** constrói mensagem:
   ```
   *Novo Pedido — Adega do Vinho*
   *Cliente:* João
   *Telefone:* 11999...
   *Bairro/Região:* Jardins
   *Endereço:* Rua X, 100
   *Itens:*
   • 2x Malbec — R$ 145,00
   *Subtotal:* R$ 145,00
   *Taxa de entrega:* R$ 12,00
   *Total:* R$ 157,00
   *Pagamento:* Pix para a adega
   *Chave Pix (E-mail):* contato@adegadovinho.com.br
   *Observações:* tocar interfone
   Pedido #A1B2C3D4
   ```
10. `window.open("https://wa.me/<numero>?text=" + encodeURIComponent(msg))`. O cliente envia a mensagem manualmente.
11. **Admin** abre `/admin/pedidos`, vê o pedido no topo (ordenado por data desc). Expande, lê detalhes.
12. **Admin** muda status no Select → `PATCH /api/orders/{id}/status`. Cliente verá o novo status em `/conta` no próximo refresh.

---

## 10. Configurações White Label

### 10.1. Onde

`backend/store_config.py`. É um único `dict` chamado `STORE_CONFIG`. É exposto via `GET /api/config` (público).

### 10.2. Campos

| Campo | Tipo | Onde aparece |
|---|---|---|
| `name` | string | Header, hero, mensagem WhatsApp, sidebar admin, `<title>` |
| `tagline` | string | Pequena chamada acima do nome no hero |
| `logo_url` | string | Reservado (hoje renderizamos o nome em texto se vazio) |
| `primary_color` | string (hex) | Cor da marca (também presente como `brand` no Tailwind) |
| `secondary_color` | string (hex) | Acento dourado |
| `whatsapp_number` | string | Número usado no `wa.me/` (só dígitos, com país + DDD) |
| `address` | string | Exibido no hero |
| `pix_key` | string | Mostrada no checkout quando pagamento = Pix |
| `pix_key_type` | string | Rótulo (E-mail, CNPJ, Celular...) |
| `banner_url` | string | Imagem do hero |
| `currency_symbol` | string | Reservado (hoje usamos `Intl` pt-BR) |
| `currency_code` | string | Reservado |
| `delivery_note` | string | Texto pequeno no hero (ex: "Entrega em até 60min") |

### 10.3. Como personalizar para uma nova adega

1. Edite `backend/store_config.py` com os novos valores.
2. Para mudar a cor principal **visualmente**: além de `STORE_CONFIG.primary_color`, editar:
   - `frontend/tailwind.config.js` → `colors.brand` (`DEFAULT`, `dark`, `gold`)
   - `frontend/src/index.css` → variáveis CSS `--primary` (HSL)
3. Para mudar a **fonte**:
   - `frontend/public/index.html` → `<link>` do Google Fonts
   - `frontend/tailwind.config.js` → `fontFamily.sans` / `fontFamily.serif`
4. Logo (imagem): hoje renderizamos o nome em texto. Para usar imagem:
   - Preencher `STORE_CONFIG.logo_url`.
   - Em `frontend/src/components/Header.jsx`, ajustar o link do logo para renderizar `<img src={config.logo_url}/>` quando existir.
5. Banner: trocar `STORE_CONFIG.banner_url` (URL pública de imagem).
6. WhatsApp: trocar `whatsapp_number` (formato internacional sem `+`, ex: `5511999990000`).
7. Pix: trocar `pix_key` e `pix_key_type`.
8. Reiniciar backend (`sudo supervisorctl restart backend`) para o `/api/config` refletir.

> 💡 Próxima evolução natural: **mover o `STORE_CONFIG` para uma coleção `store_settings` no Mongo** e expor uma tela "Configurações" no admin. Hoje, por requisito do problema, isso fica fora do alcance do admin.

---

## 11. Variáveis de Ambiente

### 11.1. Backend (`backend/.env`)

| Variável | Obrigatório | Default sugerido | Função |
|---|---|---|---|
| `MONGO_URL` | sim | `mongodb://localhost:27017` | Conexão Mongo |
| `DB_NAME` | sim | `adega_delivery` | Nome do banco |
| `JWT_SECRET` | sim | string aleatória 64 chars | Assinatura dos JWTs (HS256) |
| `ADMIN_EMAIL` | sim | `admin@adega.com` | Email do admin semeado no startup |
| `ADMIN_PASSWORD` | sim | `admin123` | Senha do admin semeado |
| `FRONTEND_URL` | recomendado | URL pública do frontend | Usado para CORS / cookies em produção |
| `CORS_ORIGINS` | opcional | `*` | (Não consumido atualmente — preparado para futuro lockdown) |

> 🔐 **Atenção**: trocar `JWT_SECRET` em produção. Trocar `ADMIN_PASSWORD` no primeiro login. O backend re-hasheia a senha do admin no startup se ela divergir do `.env` — útil para reset, mas **mantenha o `.env` fora de Git**.

### 11.2. Frontend (`frontend/.env`)

| Variável | Função |
|---|---|
| `REACT_APP_BACKEND_URL` | URL pública do backend (base para `axios`). **Não inclua `/api`** — o código adiciona. |
| `WDS_SOCKET_PORT` | (CRA dev) — geralmente já configurado. |

**Não delete chaves existentes do `.env`** — o ambiente Emergent depende delas. Adicione novas linhas.

---

## 12. Dependências

### 12.1. Backend (`backend/requirements.txt`)

Principais pacotes utilizados:

```
fastapi
uvicorn[standard]
motor                 # MongoDB async driver
pymongo
pydantic >= 2
pydantic[email]       # EmailStr
python-dotenv
PyJWT
bcrypt
```

> Sempre instalar com `pip install <pkg>` e depois `pip freeze > /app/backend/requirements.txt` para manter sincronizado.

### 12.2. Frontend (`frontend/package.json`)

Principais runtime:

```
react @19
react-dom @19
react-router-dom @7
axios
tailwindcss @3
tailwindcss-animate
class-variance-authority
clsx
tailwind-merge
lucide-react
sonner
date-fns
react-hook-form
zod
@hookform/resolvers
@radix-ui/* (várias — consumidas via shadcn/ui)
embla-carousel-react
react-day-picker
cmdk
input-otp
react-resizable-panels
vaul
```

Dev:

```
react-scripts (CRA)
craco (overrides do CRA)
eslint, postcss, autoprefixer
```

> Sempre instalar com `yarn add <pkg>`. **Nunca usar `npm`**.

---

## 13. Guia de Deploy

### 13.1. Rodar localmente

**Pré-requisitos**: Python 3.11+, Node 18+, Yarn, MongoDB local ou Atlas.

```bash
# 1. Clonar
git clone <repo> adega-delivery && cd adega-delivery

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # ou crie manualmente — ver seção 11
uvicorn server:app --reload --port 8001

# 3. Frontend (em outro terminal)
cd frontend
yarn install
# crie frontend/.env com REACT_APP_BACKEND_URL=http://localhost:8001
yarn start  # abre em http://localhost:3000
```

No ambiente Emergent, ambos os serviços rodam sob `supervisord`:

```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo supervisorctl status
```

### 13.2. MongoDB Atlas

1. Criar cluster gratuito em https://cloud.mongodb.com.
2. Criar usuário do banco. Liberar IP (`0.0.0.0/0` em dev).
3. Pegar a connection string (`mongodb+srv://<user>:<pwd>@cluster.xxx.mongodb.net/`).
4. Setar no `.env`:
   ```
   MONGO_URL=mongodb+srv://USER:PWD@cluster.xxx.mongodb.net/?retryWrites=true&w=majority
   DB_NAME=adega_delivery
   ```
5. Reiniciar o backend. O startup vai criar índices e popular dados de exemplo se as coleções estiverem vazias.

### 13.3. Backend em Render

1. **New +** → **Web Service** → conectar repo.
2. Root directory: `backend/`.
3. Build: `pip install -r requirements.txt`.
4. Start: `uvicorn server:app --host 0.0.0.0 --port $PORT`.
5. Environment vars: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_URL`.
6. Após deploy, anotar a URL (ex: `https://adega-backend.onrender.com`).

### 13.4. Backend em Railway

1. **New Project** → **Deploy from GitHub repo**.
2. Selecionar a pasta `backend/` (ou Railway detecta o `requirements.txt` automaticamente).
3. Setar Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`.
4. Adicionar as mesmas variáveis de ambiente do Render.

### 13.5. Frontend em Vercel

1. Importar o repo. Root directory: `frontend/`.
2. Framework: **Create React App**.
3. Environment Variables:
   ```
   REACT_APP_BACKEND_URL=https://adega-backend.onrender.com
   ```
4. Build command (padrão CRA): `yarn build`.
5. Output directory: `build`.
6. Deploy.

> ⚠️ Se for usar **cookies httpOnly cross-site**, o backend precisa estar no **mesmo domínio raiz** do frontend (subdomínios contam) e os cookies estão configurados com `secure=true; samesite=none`. Caso contrário, o fallback do **Authorization Bearer** garante que a autenticação continua funcionando.

### 13.6. Publicar em produção (checklist)

- [ ] Trocar `JWT_SECRET` por uma string segura (32+ bytes random).
- [ ] Trocar `ADMIN_PASSWORD`.
- [ ] Restringir CORS para o domínio real (editar `server.py`).
- [ ] Habilitar HTTPS em ambos.
- [ ] Setar `REACT_APP_BACKEND_URL` apontando para o backend de produção.
- [ ] Configurar backup automático do MongoDB Atlas.
- [ ] Configurar logging (Sentry, etc.) — opcional, P2.
- [ ] Customizar `backend/store_config.py` com os dados reais da loja.

---

## 14. Melhorias Futuras

### P1 — Alta prioridade (segurança / integridade)

1. **Calcular `unit_price` no backend** a partir de `products.id` em vez de confiar no payload do cliente. Hoje, um cliente malicioso pode enviar `unit_price=0.01` e burlar o `min_order`.
2. **Validar `fee >= 0` e `min_order >= 0`** em `DeliveryAreaIn` (Pydantic `Field(ge=0)`).
3. **Restringir CORS** ao domínio real do frontend (não `https?://.*`).
4. **Endpoint de refresh** (`POST /api/auth/refresh`) — o refresh token já é emitido, falta consumi-lo.
5. **Upload de imagens** (Cloudinary, S3 ou Emergent object storage) em vez de URL externa — UX muito melhor para o admin.

### P2 — Média prioridade (funcionalidade)

6. **Tela de configurações white-label no admin** (com os campos do `STORE_CONFIG` movidos para uma coleção `store_settings`).
7. **Cupom de desconto** (admin cria código → aplicado no checkout).
8. **Frete grátis acima de R$ X** por área de entrega.
9. **Mercado Pago / Stripe** para pagamento online (hoje todos métodos são "pagar no momento da entrega" ou Pix manual).
10. **Notificação ao admin** quando entrar pedido novo (push do navegador ou e-mail via Resend/SendGrid).
11. **Reset de senha por e-mail** (envio de link com token de uso único).
12. **Múltiplos endereços salvos** no perfil do cliente (campo `addresses` já existe na model, falta UI).

### P3 — Baixa prioridade (polimento)

13. **PWA** — service worker + manifesto para instalação no celular.
14. **Relatórios avançados** — vendas por período, top produtos, ticket médio.
15. **Substituir `window.confirm`** por `AlertDialog` (shadcn) em `Products.jsx`, `Categories.jsx`, `DeliveryAreas.jsx`.
16. **Internacionalização** (i18n) — hoje a UI está hard-coded em pt-BR.
17. **Tema escuro** — variáveis CSS `.dark` já existem em `index.css`, falta um toggle.
18. **Skeleton loaders mais ricos** (hoje só na home).
19. **Filtros adicionais no admin** (período, cliente, valor).

---

## Apêndice A — Comandos úteis

```bash
# Reiniciar serviços
sudo supervisorctl restart backend frontend

# Ver logs
tail -n 100 /var/log/supervisor/backend.err.log
tail -n 100 /var/log/supervisor/frontend.err.log

# Testar API
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
curl -s $API/api/config | python3 -m json.tool

# Login admin e listar pedidos
TOKEN=$(curl -s -X POST $API/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@adega.com","password":"admin123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s $API/api/orders -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Lint
cd /app && \
  python -m ruff check backend/ && \
  cd frontend && yarn lint  # se script existir; senão, eslint src
```

## Apêndice B — Credenciais de teste

Mantidas em `/app/memory/test_credentials.md`:

- **Admin** — `admin@adega.com` / `admin123` (semeado no startup).
- **Cliente de teste** — criar via `POST /api/auth/register`.

## Apêndice C — Histórico de iterações

Mantido em `/app/memory/PRD.md`. Resumo:

- **Iter 1 (2026-02)**: MVP completo — auth JWT, storefront, carrinho, checkout com WhatsApp, painel admin com CRUD e gestão de pedidos. 23/23 testes backend.
- **Iter 2 (2026-02)**: Áreas de entrega (CRUD admin), taxa por bairro, pedido mínimo, mensagem WhatsApp incluindo subtotal/taxa/total/região. 37/37 testes backend (23 regressão + 14 novos).
