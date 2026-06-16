# Deploy Checklist

## 1. GitHub

- [ ] Garantir que `main` está atualizado.
- [ ] Confirmar que `.env`, secrets, `node_modules`, `build`, `.venv`, logs e temporários não estão versionados.
- [ ] Conferir que `backend/.env.example` e `frontend/.env.example` existem.
- [ ] Rodar testes e build antes do deploy.

## 2. MongoDB Atlas

- [ ] Criar cluster.
- [ ] Criar usuário de banco com senha forte.
- [ ] Configurar Network Access para o provedor do backend.
- [ ] Copiar connection string para `MONGO_URL`.
- [ ] Definir `DB_NAME`.

## 3. Cloudinary

- [ ] Criar conta/projeto.
- [ ] Copiar `CLOUDINARY_CLOUD_NAME`.
- [ ] Copiar `CLOUDINARY_API_KEY`.
- [ ] Copiar `CLOUDINARY_API_SECRET`.
- [ ] Configurar as variáveis no backend.
- [ ] Testar upload de imagem no painel admin.

## 4. Backend: Render ou Railway

- [ ] Criar serviço apontando para o repositório.
- [ ] Definir root directory como `backend`.
- [ ] Build command: `pip install -r requirements.txt`.
- [ ] Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`.
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

## 5. Frontend: Vercel

- [ ] Criar projeto apontando para o repositório.
- [ ] Definir root directory como `frontend`.
- [ ] Install command: `yarn install`.
- [ ] Build command: `yarn build`.
- [ ] Output directory: `build`.
- [ ] Configurar `REACT_APP_BACKEND_URL` com a URL HTTPS do backend.
- [ ] Fazer deploy.
- [ ] Atualizar `FRONTEND_URL` no backend com a URL HTTPS da Vercel.
- [ ] Redeploy do backend se `FRONTEND_URL` mudou.

## 6. Testes Finais

- [ ] Abrir frontend publicado.
- [ ] Login admin.
- [ ] Criar/editar produto.
- [ ] Fazer upload de imagem de produto.
- [ ] Criar pedido de teste.
- [ ] Conferir pedido no painel admin.
- [ ] Verificar CORS no navegador.
- [ ] Verificar cookies de autenticação.

## 7. Domínio Personalizado

- [ ] Configurar domínio do frontend na Vercel.
- [ ] Configurar domínio do backend no Render/Railway, se aplicável.
- [ ] Atualizar `REACT_APP_BACKEND_URL` no frontend.
- [ ] Atualizar `FRONTEND_URL` no backend.
- [ ] Validar HTTPS nos dois domínios.
- [ ] Redeploy dos serviços após mudanças de env.
