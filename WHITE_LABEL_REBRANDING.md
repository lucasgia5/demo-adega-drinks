# White Label Rebranding Guide

Este projeto foi organizado para rebrandar a loja mexendo em poucos pontos.
Para criar uma loja de quadros, altere os arquivos e variáveis abaixo antes do primeiro deploy/seed em produção.

## Fluxo Recomendado Para Uma Nova Loja

1. Crie um repositório novo a partir do template `ecomm-white-label`.
2. Configure `backend/store_config.py` com nome, logo, cores, banner, WhatsApp, Pix e domínio público.
3. Configure `backend/seed_config.py` com categorias e produtos seed da loja.
4. Defina um `DB_NAME` próprio para a loja.
5. Configure Cloudinary. Uma mesma conta pode servir várias lojas, desde que cada loja use uma pasta/prefixo próprio.
6. Rode localmente backend e frontend.
7. Valide checkout, mensagem do WhatsApp, upload de imagem e criação/listagem de pedidos.
8. Faça deploy do backend no Render ou Railway.
9. Faça deploy do frontend na Vercel.
10. Atualize `FRONTEND_URL` no backend com a URL final do frontend e redeploye o backend.

## Arquivos Principais

| O que mudar | Onde mudar |
|---|---|
| Nome, logo, cores, banner, WhatsApp, Pix, domínio público | `backend/store_config.py` |
| Categorias seed e produtos seed | `backend/seed_config.py` |
| Fallback/base visual Tailwind/shadcn | `frontend/src/index.css` e `frontend/tailwind.config.js` |
| Fallback visual do frontend | `frontend/src/whiteLabelDefaults.js` |
| Domínio real do frontend | variável `FRONTEND_URL` no backend |
| URL real do backend | variável `REACT_APP_BACKEND_URL` no frontend |
| Credenciais admin seed | variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD` no backend |

## Confirmação de Idade

Para adegas ou lojas que exigem maioridade, configure em `backend/store_config.py`:

```python
"age_gate_enabled": True,
"age_gate_min_age": 18,
"age_gate_title": "Você tem 18 anos ou mais?",
"age_gate_message": (
    "Para acessar esta loja, confirme que você tem idade legal "
    "para consumir bebidas alcoólicas."
),
```

Para lojas sem restrição de idade, use:

```python
"age_gate_enabled": False,
```

Quando ativo, o frontend bloqueia a vitrine até a confirmação e salva o aceite em `localStorage.white_label_age_confirmed`.

## 1. Nome da Loja

Edite `backend/store_config.py`:

```python
STORE_CONFIG = {
    "name": "Galeria dos Quadros",
    "tagline": "Quadros decorativos para transformar seus ambientes",
}
```

Também ajuste `frontend/src/whiteLabelDefaults.js` para um fallback coerente caso a API esteja offline.

## 2. Logo

Suba o logo em uma URL pública ou no Cloudinary e edite:

```python
"logo_url": "https://res.cloudinary.com/.../logo.png"
```

Se `logo_url` ficar vazio, o frontend renderiza o nome da loja em texto.

## 3. Cores

Edite `backend/store_config.py` para expor as cores da marca. O frontend aplica `primary_color` e `secondary_color` automaticamente nas variáveis visuais principais:

```python
"primary_color": "#1F2937",
"secondary_color": "#B08D57",
```

Se quiser ajustar tons de fundo, fontes ou tokens de fallback, edite também:

- `frontend/src/index.css`: variáveis CSS `--primary`, `--accent`, `--ring`, etc.
- `frontend/tailwind.config.js`: cores `brand`, `brand-dark`, `brand-gold`, `brand-cream`.

Para loja de quadros, uma sugestão:

- primária: grafite/charcoal
- secundária: dourado fosco ou madeira clara
- fundo: off-white/neutro

## 4. Banner

Edite `backend/store_config.py`:

```python
"banner_url": "https://.../banner-quadros.jpg"
```

Use uma imagem horizontal mostrando quadros em parede/ambiente decorado.

## 5. WhatsApp

Edite:

```python
"whatsapp_number": "5511999990000"
```

Formato obrigatório: somente dígitos, com país e DDD.

## 6. Pix

Edite:

```python
"pix_key": "financeiro@galeriadosquadros.com.br",
"pix_key_type": "E-mail",
```

## 7. Categorias Seed

Edite `backend/seed_config.py`, em `SEED_CATEGORIES`.

Exemplo para loja de quadros:

```python
SEED_CATEGORIES = [
    {"name": "Quadros Abstratos", "icon": "image"},
    {"name": "Paisagens", "icon": "image"},
    {"name": "Minimalistas", "icon": "image"},
    {"name": "Frases e Tipografia", "icon": "image"},
    {"name": "Molduras Especiais", "icon": "image"},
]
```

Importante: os nomes usados em `SEED_PRODUCTS[*]["category_name"]` precisam existir em `SEED_CATEGORIES`.

## 8. Produtos Seed

Edite `backend/seed_config.py`, em `SEED_PRODUCTS`.

Exemplo:

```python
{
    "name": "Quadro Abstrato Terracota",
    "description": "Arte abstrata em tons terrosos com moldura preta.",
    "category_name": "Quadros Abstratos",
    "price": 189.90,
    "promo_active": True,
    "promo_price": 149.90,
    "image_url": "https://res.cloudinary.com/.../quadro-abstrato.jpg",
}
```

O seed roda apenas quando a coleção `categories` está vazia. Em produção, ajuste antes do primeiro startup ou limpe o banco de teste antes de reseedar.

## 9. Domínio

Backend:

```env
FRONTEND_URL=https://www.galeriadosquadros.com.br
```

Frontend:

```env
REACT_APP_BACKEND_URL=https://api.galeriadosquadros.com.br
```

Também ajuste:

```python
"public_domain": "https://www.galeriadosquadros.com.br"
```

em `backend/store_config.py`.

## 10. Credenciais Admin

Configure no ambiente do backend:

```env
ADMIN_EMAIL=admin@galeriadosquadros.com.br
ADMIN_PASSWORD=use-uma-senha-forte
```

Não coloque credenciais reais no Git. O backend semeia/atualiza o admin no startup usando essas variáveis.

Use uma senha forte e única por loja. Se `ADMIN_PASSWORD`, `JWT_SECRET`, `MONGO_URL` ou qualquer segredo Cloudinary aparecer em print, issue, commit, log público ou repositório, rotacione a credencial imediatamente.

## Checklist Para Nova Loja de Quadros

- [ ] Criar repositório novo a partir do template.
- [ ] Alterar `backend/store_config.py`.
- [ ] Alterar `backend/seed_config.py`.
- [ ] Criar `DB_NAME` próprio por loja.
- [ ] Alterar cores em `frontend/src/index.css`.
- [ ] Alterar cores em `frontend/tailwind.config.js`.
- [ ] Alterar fallback em `frontend/src/whiteLabelDefaults.js`.
- [ ] Ativar ou desativar o age gate conforme o tipo de loja.
- [ ] Configurar Cloudinary com pasta/prefixo próprio.
- [ ] Configurar `FRONTEND_URL`.
- [ ] Configurar `REACT_APP_BACKEND_URL`.
- [ ] Configurar `ADMIN_EMAIL` e `ADMIN_PASSWORD`.
- [ ] Validar checkout, WhatsApp, upload e pedidos localmente.
- [ ] Fazer deploy backend no Render/Railway.
- [ ] Fazer deploy frontend na Vercel.
- [ ] Rodar `python -m pytest backend/tests --collect-only -q -p no:cacheprovider`.
- [ ] Rodar `cd frontend && yarn build`.
