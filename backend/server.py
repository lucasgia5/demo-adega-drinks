from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

from store_config import STORE_CONFIG

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24  # 1 day
REFRESH_TOKEN_DAYS = 7

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Adega Delivery API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": now_utc() + timedelta(days=REFRESH_TOKEN_DAYS),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie(
        key="access_token", value=access, httponly=True, secure=True,
        samesite="none", max_age=ACCESS_TOKEN_MINUTES * 60, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh, httponly=True, secure=True,
        samesite="none", max_age=REFRESH_TOKEN_DAYS * 24 * 60 * 60, path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    addresses: List[dict] = []
    created_at: str


class CategoryIn(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None


class Category(CategoryIn):
    id: str
    created_at: str


class ProductIn(BaseModel):
    name: str
    description: Optional[str] = ""
    image_url: str = ""
    price: float = Field(ge=0)
    category_id: str
    available: bool = True
    promo_active: bool = False
    promo_price: Optional[float] = Field(default=None, ge=0)


class Product(ProductIn):
    id: str
    created_at: str


class OrderItemIn(BaseModel):
    product_id: str
    quantity: int = Field(ge=1)


class OrderItem(OrderItemIn):
    name: str
    unit_price: float = Field(ge=0)  # actual price charged (promo or regular)


class DeliveryAreaIn(BaseModel):
    name: str
    fee: float = Field(default=0.0, ge=0)
    min_order: Optional[float] = Field(default=None, ge=0)
    active: bool = True


class DeliveryArea(DeliveryAreaIn):
    id: str
    created_at: str


class OrderIn(BaseModel):
    customer_name: str
    customer_phone: str
    customer_address: str
    payment_method: Literal["pix", "dinheiro", "cartao"]
    items: List[OrderItemIn]
    observations: Optional[str] = ""
    delivery_area_id: Optional[str] = None


class Order(BaseModel):
    id: str
    customer_name: str
    customer_phone: str
    customer_address: str
    payment_method: str
    items: List[OrderItem]
    observations: str = ""
    total: float
    status: str
    user_id: Optional[str] = None
    created_at: str


class OrderStatusIn(BaseModel):
    status: Literal["recebido", "em_preparo", "saiu_entrega", "entregue", "cancelado"]


# ---------------------------------------------------------------------------
# Auth Routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "phone": payload.phone or "",
        "role": "customer",
        "addresses": [],
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    access = create_access_token(user_id, email, "customer")
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return {"user": doc, "access_token": access}


@api_router.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
    access = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "access_token": access}


@api_router.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# Store config (public)
# ---------------------------------------------------------------------------
@api_router.get("/config")
async def get_store_config():
    public = {k: v for k, v in STORE_CONFIG.items()}
    return public


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
@api_router.get("/categories")
async def list_categories():
    docs = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return docs


@api_router.post("/categories")
async def create_category(payload: CategoryIn, _: dict = Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "description": payload.description or "",
        "icon": payload.icon or "",
        "created_at": iso(now_utc()),
    }
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/categories/{cat_id}")
async def update_category(cat_id: str, payload: CategoryIn, _: dict = Depends(require_admin)):
    res = await db.categories.update_one(
        {"id": cat_id},
        {"$set": {
            "name": payload.name.strip(),
            "description": payload.description or "",
            "icon": payload.icon or "",
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    doc = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    return doc


@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, _: dict = Depends(require_admin)):
    in_use = await db.products.find_one({"category_id": cat_id})
    if in_use:
        raise HTTPException(status_code=400, detail="Categoria possui produtos vinculados")
    res = await db.categories.delete_one({"id": cat_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
@api_router.get("/products")
async def list_products(category_id: Optional[str] = None, search: Optional[str] = None):
    query: dict = {}
    if category_id:
        query["category_id"] = category_id
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    docs = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.get("/products/{prod_id}")
async def get_product(prod_id: str):
    doc = await db.products.find_one({"id": prod_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return doc


@api_router.post("/products")
async def create_product(payload: ProductIn, _: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = iso(now_utc())
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/products/{prod_id}")
async def update_product(prod_id: str, payload: ProductIn, _: dict = Depends(require_admin)):
    res = await db.products.update_one({"id": prod_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    doc = await db.products.find_one({"id": prod_id}, {"_id": 0})
    return doc


@api_router.delete("/products/{prod_id}")
async def delete_product(prod_id: str, _: dict = Depends(require_admin)):
    res = await db.products.delete_one({"id": prod_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------
def compute_subtotal(items: List[OrderItem]) -> float:
    return round(sum(i.unit_price * i.quantity for i in items), 2)


def resolve_product_price(product: dict) -> float:
    price = float(product.get("price", 0))
    if price < 0:
        raise HTTPException(status_code=400, detail="Produto com preco invalido")

    promo_price = product.get("promo_price")
    if promo_price is not None and float(promo_price) < 0:
        raise HTTPException(status_code=400, detail="Produto com preco promocional invalido")

    if product.get("promo_active", False) and promo_price is not None:
        return round(float(promo_price), 2)
    return round(price, 2)


async def build_priced_order_items(items: List[OrderItemIn]) -> List[OrderItem]:
    priced_items: List[OrderItem] = []
    for item in items:
        product = await db.products.find_one({"id": item.product_id}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=400, detail="Produto nao encontrado")
        if not product.get("available", True):
            raise HTTPException(status_code=400, detail="Produto indisponivel")

        priced_items.append(
            OrderItem(
                product_id=product["id"],
                name=product.get("name", ""),
                quantity=item.quantity,
                unit_price=resolve_product_price(product),
            )
        )
    return priced_items


@api_router.post("/orders")
async def create_order(payload: OrderIn, request: Request):
    user_id: Optional[str] = None
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if token:
        try:
            decoded = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            user_id = decoded.get("sub")
        except jwt.PyJWTError:
            user_id = None

    if not payload.items:
        raise HTTPException(status_code=400, detail="Carrinho vazio")

    priced_items = await build_priced_order_items(payload.items)

    # Resolve delivery area
    delivery_area_id = None
    delivery_area_name = ""
    delivery_fee = 0.0
    if payload.delivery_area_id:
        area = await db.delivery_areas.find_one(
            {"id": payload.delivery_area_id}, {"_id": 0}
        )
        if not area:
            raise HTTPException(status_code=400, detail="Área de entrega inválida")
        if not area.get("active", True):
            raise HTTPException(status_code=400, detail="Área de entrega indisponível")
        area_fee = float(area.get("fee", 0) or 0)
        if area_fee < 0:
            raise HTTPException(status_code=400, detail="Taxa de entrega invalida")
        min_order_value = area.get("min_order")
        if min_order_value is not None and float(min_order_value) < 0:
            raise HTTPException(status_code=400, detail="Pedido minimo invalido")
        delivery_area_id = area["id"]
        delivery_area_name = area["name"]
        delivery_fee = area_fee

    subtotal = compute_subtotal(priced_items)

    # Enforce min_order if defined
    if payload.delivery_area_id:
        min_order = area.get("min_order")
        if min_order is not None and subtotal < float(min_order):
            raise HTTPException(
                status_code=400,
                detail=f"Pedido mínimo para {delivery_area_name} é R$ {float(min_order):.2f}",
            )

    total = round(subtotal + delivery_fee, 2)

    doc = {
        "id": str(uuid.uuid4()),
        "customer_name": payload.customer_name.strip(),
        "customer_phone": payload.customer_phone.strip(),
        "customer_address": payload.customer_address.strip(),
        "payment_method": payload.payment_method,
        "items": [i.model_dump() for i in priced_items],
        "observations": payload.observations or "",
        "subtotal": subtotal,
        "delivery_area_id": delivery_area_id,
        "delivery_area_name": delivery_area_name,
        "delivery_fee": delivery_fee,
        "total": total,
        "status": "recebido",
        "user_id": user_id,
        "created_at": iso(now_utc()),
    }
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/orders")
async def list_orders(_: dict = Depends(require_admin)):
    docs = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@api_router.get("/orders/mine")
async def list_my_orders(user: dict = Depends(get_current_user)):
    docs = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: OrderStatusIn, _: dict = Depends(require_admin)):
    res = await db.orders.update_one({"id": order_id}, {"$set": {"status": payload.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return doc


# ---------------------------------------------------------------------------
# Delivery Areas
# ---------------------------------------------------------------------------
@api_router.get("/delivery-areas")
async def list_active_delivery_areas():
    """Public endpoint - returns only active areas for the storefront/checkout."""
    docs = await db.delivery_areas.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(500)
    return docs


@api_router.get("/admin/delivery-areas")
async def list_all_delivery_areas(_: dict = Depends(require_admin)):
    docs = await db.delivery_areas.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return docs


@api_router.post("/admin/delivery-areas")
async def create_delivery_area(payload: DeliveryAreaIn, _: dict = Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "fee": float(payload.fee or 0),
        "min_order": float(payload.min_order) if payload.min_order is not None else None,
        "active": bool(payload.active),
        "created_at": iso(now_utc()),
    }
    await db.delivery_areas.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/delivery-areas/{area_id}")
async def update_delivery_area(area_id: str, payload: DeliveryAreaIn, _: dict = Depends(require_admin)):
    update = {
        "name": payload.name.strip(),
        "fee": float(payload.fee or 0),
        "min_order": float(payload.min_order) if payload.min_order is not None else None,
        "active": bool(payload.active),
    }
    res = await db.delivery_areas.update_one({"id": area_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Área não encontrada")
    doc = await db.delivery_areas.find_one({"id": area_id}, {"_id": 0})
    return doc


@api_router.delete("/admin/delivery-areas/{area_id}")
async def delete_delivery_area(area_id: str, _: dict = Depends(require_admin)):
    res = await db.delivery_areas.delete_one({"id": area_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Área não encontrada")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@api_router.get("/admin/stats")
async def admin_stats(_: dict = Depends(require_admin)):
    total_orders = await db.orders.count_documents({})
    total_products = await db.products.count_documents({})
    total_categories = await db.categories.count_documents({})
    revenue_agg = await db.orders.aggregate([
        {"$match": {"status": {"$ne": "cancelado"}}},
        {"$group": {"_id": None, "sum": {"$sum": "$total"}}}
    ]).to_list(1)
    revenue = revenue_agg[0]["sum"] if revenue_agg else 0
    by_status_agg = await db.orders.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(100)
    by_status = {row["_id"]: row["count"] for row in by_status_agg}
    return {
        "total_orders": total_orders,
        "total_products": total_products,
        "total_categories": total_categories,
        "revenue": round(revenue, 2),
        "orders_by_status": by_status,
    }


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("category_id")
    await db.orders.create_index("created_at")
    await db.delivery_areas.create_index("name")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@adega.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Administrador",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "phone": "",
            "role": "admin",
            "addresses": [],
            "created_at": iso(now_utc()),
        })
        logger.info("Admin user seeded: %s", admin_email)
    else:
        if not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}},
            )
            logger.info("Admin password updated")

    # Seed sample delivery areas only if empty
    if await db.delivery_areas.count_documents({}) == 0:
        seed_areas = [
            {"name": "Centro", "fee": 8.0, "min_order": 0, "active": True},
            {"name": "Jardins", "fee": 12.0, "min_order": 50, "active": True},
            {"name": "Vila Madalena", "fee": 15.0, "min_order": 60, "active": True},
            {"name": "Pinheiros", "fee": 14.0, "min_order": 50, "active": True},
            {"name": "Moema", "fee": 18.0, "min_order": 80, "active": True},
        ]
        for a in seed_areas:
            await db.delivery_areas.insert_one({
                "id": str(uuid.uuid4()),
                "name": a["name"],
                "fee": a["fee"],
                "min_order": a["min_order"] if a["min_order"] else None,
                "active": a["active"],
                "created_at": iso(now_utc()),
            })
        logger.info("Seeded sample delivery areas")

    # Seed sample categories/products only if empty
    if await db.categories.count_documents({}) == 0:
        seed_cats = [
            {"name": "Vinhos Tintos", "icon": "wine"},
            {"name": "Vinhos Brancos", "icon": "wine"},
            {"name": "Espumantes", "icon": "wine"},
            {"name": "Cervejas Especiais", "icon": "beer"},
            {"name": "Destilados", "icon": "glass"},
        ]
        cat_ids = {}
        for c in seed_cats:
            cid = str(uuid.uuid4())
            await db.categories.insert_one({
                "id": cid, "name": c["name"], "description": "",
                "icon": c["icon"], "created_at": iso(now_utc()),
            })
            cat_ids[c["name"]] = cid

        sample_img_1 = "https://images.unsplash.com/photo-1695048475597-08d65f119252?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHw0fHx3aW5lJTIwYm90dGxlJTIwcHJlbWl1bXxlbnwwfHx8fDE3ODE1MzM0OTF8MA&ixlib=rb-4.1.0&q=85"
        sample_img_2 = "https://images.unsplash.com/photo-1695048475751-5d3b5077d631?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwzfHx3aW5lJTIwYm90dGxlJTIwcHJlbWl1bXxlbnwwfHx8fDE3ODE1MzM0OTF8MA&ixlib=rb-4.1.0&q=85"

        seed_products = [
            ("Cabernet Sauvignon Reserva", "Vinho tinto encorpado com notas de carvalho e frutas vermelhas.", "Vinhos Tintos", 89.90, True, 64.90, sample_img_1),
            ("Malbec Argentino", "Tinto argentino, ideal para carnes vermelhas.", "Vinhos Tintos", 72.50, False, None, sample_img_2),
            ("Merlot Chileno", "Suave, redondo e com final aveludado.", "Vinhos Tintos", 59.00, False, None, sample_img_1),
            ("Chardonnay Sur Lie", "Branco amanteigado com toque de baunilha.", "Vinhos Brancos", 68.00, True, 49.90, sample_img_2),
            ("Sauvignon Blanc", "Refrescante, cítrico e mineral.", "Vinhos Brancos", 54.00, False, None, sample_img_1),
            ("Prosecco Italiano", "Espumante leve e festivo.", "Espumantes", 79.00, True, 59.00, sample_img_2),
            ("Champagne Brut", "Champagne francês, perlage fina e elegante.", "Espumantes", 320.00, False, None, sample_img_1),
            ("IPA Artesanal 500ml", "Cerveja IPA com lúpulo cítrico marcante.", "Cervejas Especiais", 24.90, False, None, sample_img_2),
            ("Stout Imperial", "Cerveja escura, encorpada, com notas de café.", "Cervejas Especiais", 28.90, True, 22.90, sample_img_1),
            ("Whisky 12 anos", "Single malt envelhecido em barris de carvalho.", "Destilados", 289.00, False, None, sample_img_2),
            ("Gin London Dry", "Gin clássico com botânicos selecionados.", "Destilados", 159.00, True, 119.00, sample_img_1),
        ]
        for name, desc, cat, price, promo, promo_price, img in seed_products:
            await db.products.insert_one({
                "id": str(uuid.uuid4()),
                "name": name, "description": desc,
                "image_url": img,
                "price": price,
                "category_id": cat_ids[cat],
                "available": True,
                "promo_active": promo,
                "promo_price": promo_price,
                "created_at": iso(now_utc()),
            })
        logger.info("Seeded sample categories and products")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ---------------------------------------------------------------------------
# Mount router & CORS
# ---------------------------------------------------------------------------
app.include_router(api_router)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
