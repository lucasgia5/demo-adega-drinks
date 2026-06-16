# E-commerce White Label

Aplicação white label de delivery/e-commerce com vitrine pública, carrinho, checkout via WhatsApp, painel administrativo, gestão de produtos, categorias, pedidos, áreas de entrega e upload de imagens via Cloudinary.

## Stack

- Frontend: React, CRA/Craco, Tailwind CSS, shadcn/Radix UI, Axios.
- Backend: FastAPI, Motor/PyMongo, Pydantic, JWT, bcrypt.
- Banco: MongoDB Atlas em produção.
- Imagens: Cloudinary.
- Deploy recomendado: Vercel para frontend e Render ou Railway para backend.

## Como Rodar Localmente

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
copy .env.example .env
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Configure `backend/.env` antes de iniciar:

```env
APP_ENV=development
MONGO_URL=mongodb://localhost:27017
DB_NAME=adega_delivery
JWT_SECRET=replace-with-a-random-64-character-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-admin-password
FRONTEND_URL=http://localhost:3000
CLOUDINARY_CLOUD_NAME=replace-with-cloud-name
CLOUDINARY_API_KEY=replace-with-api-key
CLOUDINARY_API_SECRET=replace-with-api-secret
```

### Frontend

```bash
cd frontend
yarn install
copy .env.example .env
yarn start
```

Configure `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

## MongoDB Atlas

1. Crie um cluster no MongoDB Atlas.
2. Crie um usuário de banco com senha forte.
3. Libere o IP do provedor de backend ou use a regra recomendada pelo Render/Railway.
4. Copie a connection string para `MONGO_URL`.
5. Defina `DB_NAME` com o nome do banco da loja.

## Cloudinary

1. Crie uma conta/projeto no Cloudinary.
2. Copie `Cloud name`, `API key` e `API secret`.
3. Configure no backend:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
4. O upload de produtos salva o arquivo no Cloudinary e persiste apenas a URL segura em `products.image_url`.

## Deploy do Backend: Render ou Railway

Configuração recomendada:

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Environment variables:
  - `APP_ENV=production`
  - `MONGO_URL`
  - `DB_NAME`
  - `JWT_SECRET`
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`
  - `FRONTEND_URL`
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`

Em produção, o backend exige `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `FRONTEND_URL`. `FRONTEND_URL` deve usar HTTPS.

## Deploy do Frontend: Vercel

Configuração recomendada:

- Root directory: `frontend`
- Install command: `yarn install`
- Build command: `yarn build`
- Output directory: `build`
- Environment variables:
  - `REACT_APP_BACKEND_URL=https://url-do-backend`

Depois do deploy, copie a URL HTTPS da Vercel para `FRONTEND_URL` no backend.

## Checklist de Produção

- Repositório GitHub atualizado.
- MongoDB Atlas configurado com usuário e IP/network access.
- Cloudinary configurado.
- Backend publicado no Render/Railway com start command `uvicorn server:app --host 0.0.0.0 --port $PORT`.
- Frontend publicado na Vercel com `yarn build`.
- `APP_ENV=production` definido no backend.
- `JWT_SECRET` forte e único.
- `ADMIN_EMAIL` e `ADMIN_PASSWORD` fortes.
- `FRONTEND_URL` usando a URL HTTPS real do frontend.
- `REACT_APP_BACKEND_URL` usando a URL HTTPS real do backend.
- Testes e build executados antes do deploy final.
- Domínio personalizado configurado, se aplicável.

## Validações Úteis

```bash
python -m pytest backend/tests --collect-only -q -p no:cacheprovider
cd frontend && yarn build
```
