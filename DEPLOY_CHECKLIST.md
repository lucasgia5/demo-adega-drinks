# Deploy Checklist

## 1. GitHub

- [ ] Criar novo repositório a partir do template `ecomm-white-label`.
- [ ] Confirmar que `.env`, secrets, `node_modules`, `build`, `.venv`, logs e temporários não estão versionados.
- [ ] Conferir que `backend/.env.example` e `frontend/.env.example` existem e não possuem valores reais.
- [ ] Rodar testes e build antes do deploy.

## 2. White Label

- [ ] Configurar `backend/store_config.py` com nome, logo, cores, banner, WhatsApp, Pix e domínio público.
- [ ] Configurar `backend/seed_config.py` com categorias e produtos seed da loja.
- [ ] Configurar `frontend/src/whiteLabelDefaults.js` com fallback genérico coerente.
- [ ] Criar `DB_NAME` próprio por loja.

## 3. MongoDB Atlas

- [ ] Criar cluster.
- [ ] Criar usuário de banco com senha forte.
- [ ] Configurar Network Access:
  - [ ] Render Free: liberar `0.0.0.0/0`, se não houver IP fixo.
  - [ ] Produção com IP conhecido: liberar apenas o IP apropriado.
- [ ] Copiar a connection string exata pelo botão **Connect** do Atlas.
- [ ] Substituir apenas usuário e senha na connection string.
- [ ] Configurar `MONGO_URL` no backend.
- [ ] Configurar `DB_NAME` específico da loja.

## 4. Cloudinary

- [ ] Criar conta/projeto ou reutilizar uma conta Cloudinary existente.
- [ ] Definir uma pasta/prefixo próprio para a loja.
- [ ] Copiar `CLOUDINARY_CLOUD_NAME`.
- [ ] Copiar `CLOUDINARY_API_KEY`.
- [ ] Copiar `CLOUDINARY_API_SECRET`.
- [ ] Configurar as variáveis apenas no `.env` local ou no Render/Railway.
- [ ] Testar upload de imagem no painel admin.

## 5. Backend: Render

- [ ] Criar Web Service apontando para o repositório.
- [ ] Definir Root Directory como `backend`.
- [ ] Build Command: `pip install -r requirements.txt`.
- [ ] Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`.
- [ ] Configurar variáveis:
  - [ ] `APP_ENV=production`
  - [ ] `MONGO_URL`
  - [ ] `DB_NAME`
  - [ ] `JWT_SECRET`
  - [ ] `ADMIN_EMAIL`
  - [ ] `ADMIN_PASSWORD`
  - [ ] `FRONTEND_URL`
  - [ ] `CLOUDINARY_CLOUD_NAME`
  - [ ] `CLOUDINARY_API_KEY`
  - [ ] `CLOUDINARY_API_SECRET`
- [ ] Fazer deploy.
- [ ] Validar `GET /api/config`.

## 6. Backend: Railway

- [ ] Criar serviço apontando para a pasta `backend`.
- [ ] Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`.
- [ ] Configurar as mesmas variáveis do Render.
- [ ] Fazer deploy e validar `/api/config`.

## 7. Frontend: Vercel

- [ ] Criar projeto apontando para o repositório.
- [ ] Definir Root Directory como `frontend`.
- [ ] Install Command: `yarn install`.
- [ ] Build Command: `yarn build`.
- [ ] Output Directory: `build`.
- [ ] Configurar `REACT_APP_BACKEND_URL` com a URL HTTPS do backend, sem `/api`.
- [ ] Fazer deploy.
- [ ] Atualizar `FRONTEND_URL` no backend com a URL HTTPS da Vercel.
- [ ] Redeploy do backend se `FRONTEND_URL` mudou.

## 8. Testes Finais

- [ ] Abrir frontend publicado.
- [ ] Validar CORS no navegador.
- [ ] Login admin.
- [ ] Criar/editar produto.
- [ ] Fazer upload de imagem de produto.
- [ ] Criar pedido de teste.
- [ ] Confirmar abertura do WhatsApp com mensagem preenchida.
- [ ] Conferir pedido no painel admin.
- [ ] Verificar cookies de autenticação.

## 9. Segurança

- [ ] Confirmar que `.env` não foi commitado.
- [ ] Gerar `JWT_SECRET` forte e único por loja.
- [ ] Usar `ADMIN_PASSWORD` forte e único por loja.
- [ ] Confirmar que `MONGO_URL` não aparece no GitHub.
- [ ] Confirmar que `CLOUDINARY_API_SECRET` não aparece no GitHub.
- [ ] Rotacionar imediatamente qualquer credencial exposta em print, issue, commit ou log público.

## 10. Domínio Personalizado

- [ ] Configurar domínio do frontend na Vercel.
- [ ] Configurar domínio do backend no Render/Railway, se aplicável.
- [ ] Atualizar `REACT_APP_BACKEND_URL` no frontend.
- [ ] Atualizar `FRONTEND_URL` no backend.
- [ ] Validar HTTPS nos dois domínios.
- [ ] Redeploy dos serviços após mudanças de env.
