# PRD — Adega Delivery (White Label)

## Problem statement (original)
Web app de delivery white label para pequenos comércios, inicialmente focado em adegas.
Stack: React + Tailwind, FastAPI, MongoDB, JWT. Genérico, mas uma loja por instalação. Sem multi-tenant.

## Architecture
- `backend/` — FastAPI + Motor (MongoDB). JWT (PyJWT) + bcrypt. Routes prefixed `/api`.
- `backend/store_config.py` — White-label config (name, logo, colors, WhatsApp, address, banner, Pix key).
- `frontend/` — React + Tailwind + shadcn/ui. Lib `axios`, `sonner` (toasts), `lucide-react`.
- DB collections: `users`, `categories`, `products`, `orders`.

## User personas
- **Visitor / Customer** — browses, adds to cart, checks out as guest or with account.
- **Authenticated customer** — same + order history at `/conta`.
- **Admin** — separate login at `/admin/login`, manages catalog and orders.

## Core requirements (static)
- Catalogue with categories, search, product detail.
- Cart drawer with quantity changes; persists via localStorage.
- Checkout collects nome, telefone, endereço, observações, payment (Pix / dinheiro / cartão).
- Final action generates a formatted WhatsApp message and opens `wa.me/<number>` with the message.
- Pedido salvo no Mongo.
- Admin dashboard (totais), CRUD produtos (com promo), CRUD categorias, lista de pedidos com workflow de status (recebido → em_preparo → saiu_entrega → entregue / cancelado).
- White-label config armazenado em código (não exposto ao admin).

## What's been implemented (2026-02)
- ✅ JWT custom auth (login, register, me, logout) — httpOnly cookies + Authorization Bearer fallback.
- ✅ Admin seeded on startup (`admin@adega.com` / `admin123`).
- ✅ 5 categorias + 11 produtos com promoções de exemplo (seed automático na primeira inicialização).
- ✅ Storefront com hero, filtro por categoria, busca live, cards de produto com badge "Promo" e preço riscado/destacado.
- ✅ Cart drawer com quantidades, total e persistência.
- ✅ Checkout com Pix key + cópia, geração de mensagem WhatsApp e abertura automática do `wa.me`.
- ✅ Conta do cliente com histórico de pedidos.
- ✅ Painel admin: dashboard com 4 cards, CRUD de produtos (modal com toggle de promoção), CRUD de categorias, lista de pedidos com expand details e mudança de status via Select.
- ✅ Tema bordô + dourado, fontes Cormorant Garamond + Outfit.
- ✅ Backend testes pytest 23/23, fluxos frontend E2E principais validados.

### Iteração 2 (2026-02)
- ✅ **Áreas de entrega** — coleção `delivery_areas` com nome, taxa, pedido mínimo opcional, ativo/inativo.
- ✅ Admin `/admin/areas` com CRUD completo + toggle de ativação inline.
- ✅ Checkout com Select de bairro/região; cálculo de subtotal + taxa + total ao vivo no Resumo; valida pedido mínimo e bloqueia Confirmar quando abaixo.
- ✅ Mensagem WhatsApp inclui Bairro/Região, Subtotal, Taxa de entrega e Total final.
- ✅ Admin Orders e Account exibem Região, Subtotal, Taxa e Total separados.
- ✅ Backward compatible: pedidos antigos (sem os novos campos) renderizam normalmente.
- ✅ Testes: 37/37 pytest (23 regressão + 14 novos) + frontend E2E 100%.

## Backlog
### P0 (próximo finish)
- Nenhum bug bloqueante pendente.

### P1
- Calcular `unit_price` no backend a partir do `product_id` (atualmente o cliente envia o preço — risco de manipulação).
- Editor visual da configuração white-label (no admin) para trocar nome/cor/WhatsApp sem mexer no código.
- Upload de imagens (storage) em vez de URL externa.

### P2
- Reset de senha + verificação de e-mail.
- Notificação push para o admin quando chegar novo pedido.
- Múltiplos endereços salvos no perfil do cliente + reordenar.
- Cupom de desconto / frete dinâmico.
- Versão PWA para instalação no celular.
- Painel de relatórios (vendas por período, top produtos).

## Test credentials
See `/app/memory/test_credentials.md`.
