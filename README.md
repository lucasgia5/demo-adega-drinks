# E-commerce White Label

Aplicação white label de delivery/e-commerce com vitrine pública, carrinho, checkout via WhatsApp, painel administrativo, gestão de produtos, categorias, pedidos, áreas de entrega e upload de imagens via Cloudinary.

Para criar uma nova marca, siga o guia [WHITE_LABEL_REBRANDING.md](WHITE_LABEL_REBRANDING.md).

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

Configure `backend/.env` antes de iniciar. Use valores reais apenas no `.env` local ou nas variáveis do provedor, nunca no Git.

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

Em produção:

1. Crie um cluster no MongoDB Atlas.
2. Crie um usuário de banco com senha forte.
3. Em Network Access, libere o IP do provedor. Para Render Free, normalmente use `0.0.0.0/0`; em planos/provedores com IP fixo, prefira liberar apenas o IP apropriado.
4. Copie a connection string exata pelo botão **Connect** do Atlas.
5. Substitua apenas usuário e senha na connection string.
6. Defina `DB_NAME` com um nome específico por loja, por exemplo `loja_quadros_prod`.

## Cloudinary

- Uma única conta Cloudinary pode servir várias lojas.
- Use uma pasta/prefixo próprio por loja para organizar imagens.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` ficam apenas no `.env` local ou nas variáveis do Render/Railway.
- Nunca commite credenciais Cloudinary.
- O upload de produtos salva o arquivo no Cloudinary e persiste apenas a URL segura em `products.image_url`.

## Deploy do Backend: Render

Configuração recomendada:

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Environment Variables:
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

## Deploy do Backend: Railway

- Configure o serviço apontando para a pasta `backend`.
- Use o mesmo Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`.
- Configure as mesmas variáveis de ambiente usadas no Render.

## Deploy do Frontend: Vercel

Configuração recomendada:

- Root Directory: `frontend`
- Install Command: `yarn install`
- Build Command: `yarn build`
- Output Directory: `build`
- Environment Variables:
  - `REACT_APP_BACKEND_URL=https://url-publica-do-backend`

Depois do deploy, copie a URL HTTPS da Vercel para `FRONTEND_URL` no backend e redeploye o backend.

## Segurança

- `.env` nunca deve ser commitado.
- `JWT_SECRET` deve ser forte e único por loja.
- `ADMIN_PASSWORD` deve ser forte e único por loja.
- `MONGO_URL` e `CLOUDINARY_API_SECRET` nunca devem aparecer no GitHub, prints públicos ou issues.
- Se qualquer credencial for exposta, rotacione imediatamente no provedor correspondente.

## Checklist de Produção

- Repositório GitHub atualizado a partir do template.
- `backend/store_config.py` e `backend/seed_config.py` ajustados para a loja.
- MongoDB Atlas configurado com usuário, senha, Network Access e `DB_NAME` próprio.
- Cloudinary configurado com pasta/prefixo por loja.
- Backend publicado no Render/Railway com Root Directory `backend`.
- Frontend publicado na Vercel com `yarn build`.
- Checkout, WhatsApp, upload de imagem e pedidos validados em produção.
- Domínio personalizado configurado, se aplicável.

## Validações Úteis

```bash
python -m pytest backend/tests --collect-only -q -p no:cacheprovider
cd frontend && yarn build
```
