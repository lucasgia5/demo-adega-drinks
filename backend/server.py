from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from urllib.parse import urlparse

import bcrypt
import cloudinary
import cloudinary.uploader
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, File, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict, model_validator

from seed_config import SEED_CATEGORIES, SEED_PRODUCTS
from store_config import STORE_CONFIG

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24  # 1 day
REFRESH_TOKEN_DAYS = 7
LOCAL_FRONTEND_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_PRODUCT_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ALLOWED_PRODUCT_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def current_environment() -> str:
    return (os.environ.get("APP_ENV") or os.environ.get("ENV") or "development").strip().lower()


def is_production() -> bool:
    return current_environment() in {"production", "prod"}


def env_value(name: str) -> str:
    return os.environ.get(name, "").strip()


def require_env(name: str) -> str:
    value = env_value(name)
    if not value:
        raise RuntimeError(f"{name} must be configured")
    return value


def split_frontend_urls(value: str) -> List[str]:
    return [url.strip().rstrip("/") for url in value.split(",") if url.strip()]


def validate_origin(origin: str) -> str:
    parsed = urlparse(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeError(f"Invalid FRONTEND_URL origin: {origin}")
    return origin.rstrip("/")


def get_frontend_origins() -> List[str]:
    frontend_url = env_value("FRONTEND_URL")
    if is_production():
        origins = split_frontend_urls(require_env("FRONTEND_URL"))
    else:
        origins = split_frontend_urls(frontend_url) or LOCAL_FRONTEND_ORIGINS
    validated = [validate_origin(origin) for origin in origins]
    if is_production() and any(urlparse(origin).scheme != "https" for origin in validated):
        raise RuntimeError("FRONTEND_URL must use https in production")
    return validated


def get_cookie_settings() -> dict:
    secure = is_production()
    return {
        "httponly": True,
        "secure": secure,
        "samesite": "none" if secure else "lax",
        "path": "/",
    }


def validate_startup_environment() -> None:
    if is_production():
        require_env("JWT_SECRET")
        require_env("ADMIN_EMAIL")
        require_env("ADMIN_PASSWORD")
        get_frontend_origins()


def validate_cloudinary_environment() -> None:
    require_env("CLOUDINARY_CLOUD_NAME")
    require_env("CLOUDINARY_API_KEY")
    require_env("CLOUDINARY_API_SECRET")


def configure_cloudinary() -> None:
    validate_cloudinary_environment()
    cloudinary.config(
        cloud_name=require_env("CLOUDINARY_CLOUD_NAME"),
        api_key=require_env("CLOUDINARY_API_KEY"),
        api_secret=require_env("CLOUDINARY_API_SECRET"),
        secure=True,
    )


validate_startup_environment()

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title=f"{STORE_CONFIG['name']} API")
api_router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Catalog ordering
# ---------------------------------------------------------------------------
def has_display_order(doc: dict) -> bool:
    return isinstance(doc.get("display_order"), int)


def sort_catalog_docs(docs: List[dict], catalog_type: Literal["products", "categories", "combos"]) -> List[dict]:
    if catalog_type == "products":
        fallback = sorted(docs, key=lambda doc: doc.get("created_at", ""), reverse=True)
    elif catalog_type == "categories":
        fallback = sorted(docs, key=lambda doc: (doc.get("name") or "").lower())
    else:
        created_desc = sorted(docs, key=lambda doc: doc.get("created_at", ""), reverse=True)
        fallback = sorted(
            created_desc,
            key=lambda doc: doc.get("display_order") if has_display_order(doc) else 0,
        )

    fallback_rank = {doc.get("id"): index for index, doc in enumerate(fallback)}
    return sorted(
        docs,
        key=lambda doc: (
            0 if has_display_order(doc) else 1,
            doc.get("display_order") if has_display_order(doc) else fallback_rank.get(doc.get("id"), 0),
            fallback_rank.get(doc.get("id"), 0),
        ),
    )


async def fetch_ordered_catalog_docs(collection, catalog_type: Literal["products", "categories", "combos"], query: dict | None = None) -> List[dict]:
    docs = await collection.find(query or {}, {"_id": 0}).to_list(1000)
    return sort_catalog_docs(docs, catalog_type)


async def reorder_catalog_item(collection, catalog_type: Literal["products", "categories", "combos"], payload) -> List[dict]:
    docs = await fetch_ordered_catalog_docs(collection, catalog_type)
    index = next((idx for idx, doc in enumerate(docs) if doc.get("id") == payload.id), -1)
    if index < 0:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    target_index = index - 1 if payload.direction == "up" else index + 1
    if target_index < 0 or target_index >= len(docs):
        return docs

    docs[index], docs[target_index] = docs[target_index], docs[index]
    for display_order, doc in enumerate(docs):
        await collection.update_one(
            {"id": doc["id"]},
            {"$set": {"display_order": display_order}},
        )
        doc["display_order"] = display_order
    return docs


def sort_product_option_groups(option_groups: Optional[List[dict]]) -> List[dict]:
    sorted_groups = []
    for group in sorted(option_groups or [], key=lambda g: (g.get("order", 0), g.get("name", ""))):
        group_doc = dict(group)
        group_doc["options"] = sorted(
            [dict(option) for option in group_doc.get("options", [])],
            key=lambda o: (o.get("order", 0), o.get("name", "")),
        )
        sorted_groups.append(group_doc)
    return sorted_groups


def with_sorted_product_options(product: dict) -> dict:
    doc = dict(product)
    doc["option_groups"] = sort_product_option_groups(doc.get("option_groups", []))
    return doc


def normalize_product_option_groups(option_groups: Optional[List[dict]]) -> List[dict]:
    normalized_groups = []
    seen_group_ids = set()
    for group in option_groups or []:
        group_doc = dict(group)
        group_id = group_doc.get("id") or str(uuid.uuid4())
        if group_id in seen_group_ids:
            raise HTTPException(status_code=400, detail="Grupo de opções duplicado")
        seen_group_ids.add(group_id)
        group_doc["id"] = group_id

        normalized_options = []
        seen_option_ids = set()
        for option in group_doc.get("options", []):
            option_doc = dict(option)
            option_id = option_doc.get("id") or str(uuid.uuid4())
            if option_id in seen_option_ids:
                raise HTTPException(status_code=400, detail="Opção duplicada no grupo")
            seen_option_ids.add(option_id)
            option_doc["id"] = option_id
            normalized_options.append(option_doc)
        group_doc["options"] = sorted(
            normalized_options,
            key=lambda option: (option.get("order", 0), option.get("name", "")),
        )
        normalized_groups.append(group_doc)
    return sort_product_option_groups(normalized_groups)


def get_jwt_secret() -> str:
    return require_env("JWT_SECRET")


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
    cookie_settings = get_cookie_settings()
    response.set_cookie(
        key="access_token",
        value=access,
        max_age=ACCESS_TOKEN_MINUTES * 60,
        **cookie_settings,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh,
        max_age=REFRESH_TOKEN_DAYS * 24 * 60 * 60,
        **cookie_settings,
    )


def clear_auth_cookies(response: Response) -> None:
    cookie_settings = get_cookie_settings()
    response.delete_cookie(
        "access_token",
        path=cookie_settings["path"],
        secure=cookie_settings["secure"],
        samesite=cookie_settings["samesite"],
    )
    response.delete_cookie(
        "refresh_token",
        path=cookie_settings["path"],
        secure=cookie_settings["secure"],
        samesite=cookie_settings["samesite"],
    )


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


class StoreBrandingIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    store_name: str = Field(min_length=1, max_length=120)
    store_logo_url: str = Field(default="", max_length=1000)
    store_banner_url: str = Field(default="", max_length=1000)
    banner_title: str = Field(default="", max_length=160)
    banner_subtitle: str = Field(default="", max_length=300)
    banner_button_text: str = Field(default="", max_length=80)
    banner_button_link: str = Field(default="", max_length=1000)
    banner_enabled: bool = True


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
    display_order: Optional[int] = Field(default=None, ge=0)


class Category(CategoryIn):
    id: str
    created_at: str


class ProductOptionIn(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = ""
    additional_price: float = Field(default=0.0, ge=0)
    max_quantity: int = Field(default=1, ge=1)
    order: int = Field(default=0, ge=0)
    active: bool = True
    recommended: bool = False
    popular: bool = False


class ProductOption(ProductOptionIn):
    id: str


class ProductOptionGroupIn(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = ""
    highlight_text: Optional[str] = ""
    required: bool = False
    min_selections: int = Field(default=0, ge=0)
    max_selections: int = Field(default=1, ge=0)
    selection_type: Literal["single", "multiple", "quantity"] = "single"
    order: int = Field(default=0, ge=0)
    active: bool = True
    options: List[ProductOptionIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_selection_bounds(self):
        if self.max_selections < self.min_selections:
            raise ValueError("max_selections não pode ser menor que min_selections")
        return self


class ProductOptionGroup(ProductOptionGroupIn):
    id: str
    options: List[ProductOption] = Field(default_factory=list)


class ProductIn(BaseModel):
    name: str
    description: Optional[str] = ""
    image_url: str = ""
    price: float = Field(ge=0)
    category_id: str
    available: bool = True
    promo_active: bool = False
    promo_price: Optional[float] = Field(default=None, ge=0)
    display_order: Optional[int] = Field(default=None, ge=0)
    option_groups: List[ProductOptionGroupIn] = Field(default_factory=list)


class Product(ProductIn):
    id: str
    created_at: str
    option_groups: List[ProductOptionGroup] = Field(default_factory=list)


class ComboProductIn(BaseModel):
    product_id: str
    quantity: int = Field(ge=1)


class ComboIn(BaseModel):
    name: str
    description: Optional[str] = ""
    image_url: str = ""
    products: List[ComboProductIn]
    promotional_price: float = Field(ge=0)
    active: bool = True
    display_order: Optional[int] = Field(default=None, ge=0)


class Combo(ComboIn):
    id: str
    created_at: str


class ReorderIn(BaseModel):
    id: str
    direction: Literal["up", "down"]


class SelectedProductOptionIn(BaseModel):
    group_id: str
    option_id: str
    quantity: int = Field(default=1, ge=1)


class SelectedProductOption(BaseModel):
    group_id: str
    group_name: str
    option_id: str
    option_name: str
    quantity: int = Field(default=1, ge=1)
    additional_price: float = Field(ge=0)


class OrderItemIn(BaseModel):
    item_type: Literal["product", "combo"] = "product"
    product_id: Optional[str] = None
    combo_id: Optional[str] = None
    quantity: int = Field(ge=1)
    selected_options: List[SelectedProductOptionIn] = Field(default_factory=list)
    item_observation: Optional[str] = ""


class OrderItem(BaseModel):
    item_type: Literal["product", "combo"] = "product"
    product_id: Optional[str] = None
    combo_id: Optional[str] = None
    name: str
    quantity: int = Field(ge=1)
    base_price: Optional[float] = Field(default=None, ge=0)
    unit_price: float = Field(ge=0)  # actual price charged (promo or regular)
    combo_items: List[dict] = Field(default_factory=list)
    selected_options: List[SelectedProductOption] = Field(default_factory=list)
    item_observation: str = ""


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
    fulfillment_type: Literal["delivery", "pickup"] = "delivery"
    items: List[OrderItemIn]
    observations: Optional[str] = ""
    delivery_area_id: Optional[str] = None


class Order(BaseModel):
    id: str
    customer_name: str
    customer_phone: str
    customer_address: str
    payment_method: str
    fulfillment_type: str = "delivery"
    items: List[OrderItem]
    observations: str = ""
    free_shipping_applied: bool = False
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


@api_router.post("/auth/refresh")
async def refresh_session(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token ausente")
    try:
        payload = jwt.decode(refresh_token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expirado")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Refresh token inválido")

    access = create_access_token(user["id"], user["email"], user["role"])
    new_refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, new_refresh)
    user.pop("password_hash", None)
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
STORE_BRANDING_ID = "store_branding"


def validate_optional_url(value: str, field_name: str, allow_relative: bool = False) -> str:
    cleaned = value.strip()
    if not cleaned:
        return ""
    if allow_relative and (
        (cleaned.startswith("/") and not cleaned.startswith("//"))
        or cleaned.startswith("#")
    ):
        return cleaned
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail=f"{field_name} deve ser uma URL http(s) válida")
    return cleaned


async def get_store_branding_overrides() -> dict:
    doc = await db.store_settings.find_one({"_id": STORE_BRANDING_ID})
    if not doc:
        return {}
    doc.pop("_id", None)
    doc.pop("updated_at", None)
    return doc


async def get_effective_store_config() -> dict:
    overrides = await get_store_branding_overrides()
    public = dict(STORE_CONFIG)

    store_name = overrides.get("store_name") or public.get("name", "")
    logo_url = (
        overrides.get("store_logo_url")
        or public.get("store_logo_url")
        or public.get("logo_url", "")
    )
    banner_url = (
        overrides.get("store_banner_url")
        or public.get("store_banner_url")
        or public.get("banner_url", "")
    )

    public.update(overrides)
    public["name"] = store_name
    public["store_name"] = store_name
    public["logo_url"] = logo_url
    public["store_logo_url"] = logo_url
    public["banner_url"] = banner_url
    public["store_banner_url"] = banner_url
    public["banner_title"] = overrides.get("banner_title") or public.get("banner_title") or store_name
    public["banner_subtitle"] = (
        overrides.get("banner_subtitle") or public.get("banner_subtitle") or public.get("tagline", "")
    )
    public["banner_button_text"] = overrides.get(
        "banner_button_text", public.get("banner_button_text", "")
    )
    public["banner_button_link"] = overrides.get(
        "banner_button_link", public.get("banner_button_link", "")
    )
    public["banner_enabled"] = overrides.get(
        "banner_enabled", public.get("banner_enabled", True)
    )
    return public


@api_router.get("/config")
async def get_store_config():
    return await get_effective_store_config()


@api_router.get("/admin/store-settings")
async def get_admin_store_settings(_: dict = Depends(require_admin)):
    return await get_effective_store_config()


@api_router.put("/admin/store-settings")
async def update_admin_store_settings(
    payload: StoreBrandingIn,
    _: dict = Depends(require_admin),
):
    store_name = payload.store_name.strip()
    if not store_name:
        raise HTTPException(status_code=400, detail="store_name não pode ficar vazio")
    update = {
        "store_name": store_name,
        "store_logo_url": validate_optional_url(payload.store_logo_url, "store_logo_url"),
        "store_banner_url": validate_optional_url(payload.store_banner_url, "store_banner_url"),
        "banner_title": payload.banner_title.strip(),
        "banner_subtitle": payload.banner_subtitle.strip(),
        "banner_button_text": payload.banner_button_text.strip(),
        "banner_button_link": validate_optional_url(
            payload.banner_button_link,
            "banner_button_link",
            allow_relative=True,
        ),
        "banner_enabled": payload.banner_enabled,
        "updated_at": iso(now_utc()),
    }
    await db.store_settings.update_one(
        {"_id": STORE_BRANDING_ID},
        {"$set": update},
        upsert=True,
    )
    return await get_effective_store_config()


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
@api_router.get("/categories")
async def list_categories():
    return await fetch_ordered_catalog_docs(db.categories, "categories")


@api_router.post("/categories")
async def create_category(payload: CategoryIn, _: dict = Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "description": payload.description or "",
        "icon": payload.icon or "",
        "created_at": iso(now_utc()),
    }
    if payload.display_order is not None:
        doc["display_order"] = payload.display_order
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/categories/{cat_id}")
async def update_category(cat_id: str, payload: CategoryIn, _: dict = Depends(require_admin)):
    update = {
        "name": payload.name.strip(),
        "description": payload.description or "",
        "icon": payload.icon or "",
    }
    if payload.display_order is not None:
        update["display_order"] = payload.display_order
    res = await db.categories.update_one({"id": cat_id}, {"$set": update})
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


@api_router.post("/admin/categories/reorder")
async def reorder_categories(payload: ReorderIn, _: dict = Depends(require_admin)):
    return await reorder_catalog_item(db.categories, "categories", payload)


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
def product_image_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


async def upload_image_to_cloudinary(file: UploadFile, folder: str) -> str:
    extension = product_image_extension(file.filename or "")
    if extension not in ALLOWED_PRODUCT_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Tipo de arquivo inválido")
    if file.content_type not in ALLOWED_PRODUCT_IMAGE_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de arquivo inválido")

    contents = await file.read()
    if len(contents) > MAX_PRODUCT_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Imagem maior que o limite permitido")
    if not contents:
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    configure_cloudinary()
    result = cloudinary.uploader.upload(
        contents,
        folder=folder,
        resource_type="image",
        use_filename=True,
        unique_filename=True,
        overwrite=False,
    )
    secure_url = result.get("secure_url")
    if not secure_url:
        raise HTTPException(status_code=502, detail="Cloudinary não retornou URL segura")
    return secure_url


async def upload_product_image_to_cloudinary(file: UploadFile) -> str:
    return await upload_image_to_cloudinary(file, "ecomm-white-label/products")


async def upload_combo_image_to_cloudinary(file: UploadFile) -> str:
    return await upload_image_to_cloudinary(file, "ecomm-white-label/combos")


@api_router.get("/products")
async def list_products(category_id: Optional[str] = None, search: Optional[str] = None):
    query: dict = {}
    if category_id:
        query["category_id"] = category_id
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    docs = await fetch_ordered_catalog_docs(db.products, "products", query)
    return [with_sorted_product_options(doc) for doc in docs]


@api_router.post("/admin/products/upload-image")
async def upload_product_image(file: UploadFile = File(...), _: dict = Depends(require_admin)):
    secure_url = await upload_product_image_to_cloudinary(file)
    return {"image_url": secure_url}


@api_router.post("/admin/combos/upload-image")
async def upload_combo_image(file: UploadFile = File(...), _: dict = Depends(require_admin)):
    secure_url = await upload_combo_image_to_cloudinary(file)
    return {"image_url": secure_url}


@api_router.post("/admin/store-settings/upload-image")
async def upload_store_branding_image(
    image_type: Literal["logo", "banner"],
    file: UploadFile = File(...),
    _: dict = Depends(require_admin),
):
    secure_url = await upload_image_to_cloudinary(
        file,
        f"ecomm-white-label/store/{image_type}",
    )
    return {"image_url": secure_url, "image_type": image_type}


@api_router.get("/products/{prod_id}")
async def get_product(prod_id: str):
    doc = await db.products.find_one({"id": prod_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return with_sorted_product_options(doc)


@api_router.post("/products")
async def create_product(payload: ProductIn, _: dict = Depends(require_admin)):
    doc = payload.model_dump()
    if doc.get("display_order") is None:
        doc.pop("display_order", None)
    doc["option_groups"] = normalize_product_option_groups(doc.get("option_groups", []))
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = iso(now_utc())
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return with_sorted_product_options(doc)


@api_router.put("/products/{prod_id}")
async def update_product(prod_id: str, payload: ProductIn, _: dict = Depends(require_admin)):
    existing = await db.products.find_one({"id": prod_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Produto nÃ£o encontrado")

    update = payload.model_dump()
    if update.get("display_order") is None:
        update.pop("display_order", None)
    if "option_groups" in payload.model_fields_set:
        update["option_groups"] = normalize_product_option_groups(update.get("option_groups", []))
    else:
        update["option_groups"] = existing.get("option_groups", [])
    res = await db.products.update_one({"id": prod_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    doc = await db.products.find_one({"id": prod_id}, {"_id": 0})
    return with_sorted_product_options(doc)


@api_router.delete("/products/{prod_id}")
async def delete_product(prod_id: str, _: dict = Depends(require_admin)):
    combo_in_use = await db.combos.find_one({"products.product_id": prod_id})
    if combo_in_use:
        raise HTTPException(status_code=400, detail="Produto vinculado a um combo")
    res = await db.products.delete_one({"id": prod_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return {"ok": True}


@api_router.post("/admin/products/reorder")
async def reorder_products(payload: ReorderIn, _: dict = Depends(require_admin)):
    return await reorder_catalog_item(db.products, "products", payload)


# ---------------------------------------------------------------------------
# Combos
# ---------------------------------------------------------------------------
async def resolve_combo_products(combo_products: List[dict]) -> tuple[List[dict], bool]:
    resolved: List[dict] = []
    purchasable = True

    for combo_product in combo_products:
        product = await db.products.find_one(
            {"id": combo_product["product_id"]}, {"_id": 0}
        )
        if not product:
            purchasable = False
            continue
        if not product.get("available", True):
            purchasable = False
        resolved.append({
            "product_id": product["id"],
            "name": product.get("name", ""),
            "quantity": int(combo_product["quantity"]),
            "available": product.get("available", True),
        })

    return resolved, purchasable and len(resolved) == len(combo_products)


async def combo_response(combo: dict) -> dict:
    resolved_products, purchasable = await resolve_combo_products(combo.get("products", []))
    return {
        **combo,
        "resolved_products": resolved_products,
        "purchasable": purchasable and bool(resolved_products),
    }


async def validate_combo_payload(payload: ComboIn) -> None:
    if not payload.products:
        raise HTTPException(status_code=400, detail="Combo deve possuir produtos")
    product_ids = [item.product_id for item in payload.products]
    products = await db.products.find(
        {"id": {"$in": product_ids}}, {"_id": 0, "id": 1}
    ).to_list(len(product_ids))
    if len({product["id"] for product in products}) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="Produto do combo não encontrado")


@api_router.get("/combos")
async def list_public_combos():
    docs = await fetch_ordered_catalog_docs(db.combos, "combos", {"active": True})
    combos = [await combo_response(doc) for doc in docs]
    return [combo for combo in combos if combo["purchasable"]]


@api_router.get("/admin/combos")
async def list_admin_combos(_: dict = Depends(require_admin)):
    docs = await fetch_ordered_catalog_docs(db.combos, "combos")
    return [await combo_response(doc) for doc in docs]


@api_router.post("/admin/combos")
async def create_combo(payload: ComboIn, _: dict = Depends(require_admin)):
    await validate_combo_payload(payload)
    doc = payload.model_dump()
    doc["name"] = payload.name.strip()
    doc["description"] = payload.description or ""
    if doc.get("display_order") is None:
        doc.pop("display_order", None)
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = iso(now_utc())
    await db.combos.insert_one(doc)
    doc.pop("_id", None)
    return await combo_response(doc)


@api_router.put("/admin/combos/{combo_id}")
async def update_combo(combo_id: str, payload: ComboIn, _: dict = Depends(require_admin)):
    await validate_combo_payload(payload)
    update = payload.model_dump()
    update["name"] = payload.name.strip()
    update["description"] = payload.description or ""
    if update.get("display_order") is None:
        update.pop("display_order", None)
    res = await db.combos.update_one({"id": combo_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Combo não encontrado")
    doc = await db.combos.find_one({"id": combo_id}, {"_id": 0})
    return await combo_response(doc)


@api_router.delete("/admin/combos/{combo_id}")
async def delete_combo(combo_id: str, _: dict = Depends(require_admin)):
    res = await db.combos.delete_one({"id": combo_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Combo não encontrado")
    return {"ok": True}


@api_router.post("/admin/combos/reorder")
async def reorder_combos(payload: ReorderIn, _: dict = Depends(require_admin)):
    docs = await reorder_catalog_item(db.combos, "combos", payload)
    return [await combo_response(doc) for doc in docs]


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------
def compute_subtotal(items: List[OrderItem]) -> float:
    return round(sum(i.unit_price * i.quantity for i in items), 2)


def resolve_product_price(product: dict) -> float:
    price = float(product.get("price", 0))
    if price < 0:
        raise HTTPException(status_code=400, detail="Produto com preço inválido")

    promo_price = product.get("promo_price")
    if promo_price is not None and float(promo_price) < 0:
        raise HTTPException(status_code=400, detail="Produto com preço promocional inválido")

    if product.get("promo_active", False) and promo_price is not None:
        return round(float(promo_price), 2)
    return round(price, 2)


def resolve_selected_product_options(
    product: dict,
    selected_options: List[SelectedProductOptionIn],
) -> tuple[List[SelectedProductOption], float]:
    selections = selected_options or []
    groups = sort_product_option_groups(product.get("option_groups", []))
    active_groups = {group["id"]: group for group in groups if group.get("active", True)}

    if selections and not active_groups:
        raise HTTPException(status_code=400, detail="Produto não possui opções disponíveis")

    selections_by_group: dict[str, List[SelectedProductOptionIn]] = {}
    for selection in selections:
        selections_by_group.setdefault(selection.group_id, []).append(selection)

    resolved: List[SelectedProductOption] = []
    additional_total = 0.0

    for group in active_groups.values():
        group_selections = selections_by_group.pop(group["id"], [])
        selection_type = group.get("selection_type", "single")
        selection_count = (
            sum(selection.quantity for selection in group_selections)
            if selection_type == "quantity"
            else len(group_selections)
        )
        min_required = max(
            int(group.get("min_selections", 0)),
            1 if group.get("required", False) else 0,
        )
        max_allowed = int(group.get("max_selections", 0))

        if selection_count < min_required:
            raise HTTPException(
                status_code=400,
                detail=f"Selecione pelo menos {min_required} opção(ões) em {group.get('name', 'grupo')}",
            )
        if max_allowed > 0 and selection_count > max_allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Selecione no máximo {max_allowed} opção(ões) em {group.get('name', 'grupo')}",
            )

        options = {
            option["id"]: option
            for option in group.get("options", [])
            if option.get("active", True)
        }
        seen_options = set()
        for selection in group_selections:
            if selection.option_id in seen_options:
                raise HTTPException(status_code=400, detail="Opção duplicada no pedido")
            seen_options.add(selection.option_id)
            option = options.get(selection.option_id)
            if not option:
                raise HTTPException(status_code=400, detail="Opção inválida")

            if selection_type != "quantity" and selection.quantity != 1:
                raise HTTPException(status_code=400, detail="Quantidade inválida para opção")
            max_quantity = int(option.get("max_quantity", 1))
            if selection.quantity > max_quantity:
                raise HTTPException(status_code=400, detail="Quantidade maior que o permitido para opção")

            additional_price = float(option.get("additional_price", 0) or 0)
            if additional_price < 0:
                raise HTTPException(status_code=400, detail="Opção com preço adicional inválido")
            additional_total += additional_price * selection.quantity
            resolved.append(
                SelectedProductOption(
                    group_id=group["id"],
                    group_name=group.get("name", ""),
                    option_id=option["id"],
                    option_name=option.get("name", ""),
                    quantity=selection.quantity,
                    additional_price=round(additional_price, 2),
                )
            )

    if selections_by_group:
        raise HTTPException(status_code=400, detail="Grupo de opções inválido")

    return resolved, round(additional_total, 2)


async def build_priced_order_items(items: List[OrderItemIn]) -> List[OrderItem]:
    priced_items: List[OrderItem] = []
    for item in items:
        if item.item_type == "combo":
            if not item.combo_id:
                raise HTTPException(status_code=400, detail="Combo não informado")
            combo = await db.combos.find_one({"id": item.combo_id}, {"_id": 0})
            if not combo:
                raise HTTPException(status_code=400, detail="Combo não encontrado")
            if not combo.get("active", False):
                raise HTTPException(status_code=400, detail="Combo indisponível")

            combo_items, purchasable = await resolve_combo_products(combo.get("products", []))
            if not purchasable or not combo_items:
                raise HTTPException(
                    status_code=400,
                    detail="Combo possui produto indisponível",
                )

            combo_price = float(combo.get("promotional_price", 0))
            if combo_price < 0:
                raise HTTPException(status_code=400, detail="Combo com preço inválido")

            priced_items.append(
                OrderItem(
                    item_type="combo",
                    combo_id=combo["id"],
                    name=combo.get("name", ""),
                    quantity=item.quantity,
                    unit_price=round(combo_price, 2),
                    combo_items=[
                        {
                            "product_id": combo_item["product_id"],
                            "name": combo_item["name"],
                            "quantity": combo_item["quantity"],
                        }
                        for combo_item in combo_items
                    ],
                )
            )
            continue

        if not item.product_id:
            raise HTTPException(status_code=400, detail="Produto não informado")
        product = await db.products.find_one({"id": item.product_id}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=400, detail="Produto não encontrado")
        if not product.get("available", True):
            raise HTTPException(status_code=400, detail="Produto indisponível")

        selected_options, additional_total = resolve_selected_product_options(
            product,
            item.selected_options,
        )
        base_price = resolve_product_price(product)
        unit_price = round(base_price + additional_total, 2)

        priced_items.append(
            OrderItem(
                item_type="product",
                product_id=product["id"],
                name=product.get("name", ""),
                quantity=item.quantity,
                base_price=base_price,
                unit_price=unit_price,
                selected_options=selected_options,
                item_observation=(item.item_observation or "").strip(),
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

    # Resolve delivery area only for delivery orders.
    delivery_area_id = None
    delivery_area_name = ""
    delivery_fee = 0.0
    area = None
    if payload.fulfillment_type == "delivery" and payload.delivery_area_id:
        area = await db.delivery_areas.find_one(
            {"id": payload.delivery_area_id}, {"_id": 0}
        )
        if not area:
            raise HTTPException(status_code=400, detail="Área de entrega inválida")
        if not area.get("active", True):
            raise HTTPException(status_code=400, detail="Área de entrega indisponível")
        area_fee = float(area.get("fee", 0) or 0)
        if area_fee < 0:
            raise HTTPException(status_code=400, detail="Taxa de entrega inválida")
        min_order_value = area.get("min_order")
        if min_order_value is not None and float(min_order_value) < 0:
            raise HTTPException(status_code=400, detail="Pedido mínimo inválido")
        delivery_area_id = area["id"]
        delivery_area_name = area["name"]
        delivery_fee = area_fee

    subtotal = compute_subtotal(priced_items)

    # Enforce min_order if defined
    if payload.fulfillment_type == "delivery" and area:
        min_order = area.get("min_order")
        if min_order is not None and subtotal < float(min_order):
            raise HTTPException(
                status_code=400,
                detail=f"Pedido mínimo para {delivery_area_name} é R$ {float(min_order):.2f}",
            )

    free_shipping_applied = False
    free_shipping_minimum = float(STORE_CONFIG.get("free_shipping_minimum", 0) or 0)
    if free_shipping_minimum < 0:
        raise HTTPException(status_code=500, detail="Configuração de frete grátis inválida")
    if (
        payload.fulfillment_type == "delivery"
        and STORE_CONFIG.get("free_shipping_enabled", False)
        and subtotal >= free_shipping_minimum
    ):
        delivery_fee = 0.0
        free_shipping_applied = True

    total = round(subtotal + delivery_fee, 2)

    doc = {
        "id": str(uuid.uuid4()),
        "customer_name": payload.customer_name.strip(),
        "customer_phone": payload.customer_phone.strip(),
        "customer_address": payload.customer_address.strip(),
        "payment_method": payload.payment_method,
        "fulfillment_type": payload.fulfillment_type,
        "items": [i.model_dump() for i in priced_items],
        "observations": payload.observations or "",
        "subtotal": subtotal,
        "delivery_area_id": delivery_area_id,
        "delivery_area_name": delivery_area_name,
        "delivery_fee": delivery_fee,
        "free_shipping_applied": free_shipping_applied,
        "total": total,
        "status": "recebido",
        "user_id": user_id,
        "created_at": iso(now_utc()),
    }
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    return doc


def with_fulfillment_type(order: dict) -> dict:
    order["fulfillment_type"] = order.get("fulfillment_type") or "delivery"
    return order


@api_router.get("/orders")
async def list_orders(_: dict = Depends(require_admin)):
    docs = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [with_fulfillment_type(doc) for doc in docs]


@api_router.get("/orders/mine")
async def list_my_orders(user: dict = Depends(get_current_user)):
    docs = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [with_fulfillment_type(doc) for doc in docs]


@api_router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: OrderStatusIn, _: dict = Depends(require_admin)):
    res = await db.orders.update_one({"id": order_id}, {"$set": {"status": payload.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return with_fulfillment_type(doc)


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
    await db.products.create_index("display_order")
    await db.categories.create_index("display_order")
    await db.combos.create_index([("active", 1), ("display_order", 1)])
    await db.orders.create_index("created_at")
    await db.delivery_areas.create_index("name")

    admin_email = env_value("ADMIN_EMAIL").lower()
    admin_password = env_value("ADMIN_PASSWORD")
    if not admin_email or not admin_password:
        if is_production():
            raise RuntimeError("ADMIN_EMAIL and ADMIN_PASSWORD must be configured")
        logger.warning("Skipping admin seed because ADMIN_EMAIL or ADMIN_PASSWORD is not configured")
        admin_email = ""

    if not admin_email:
        existing = None
    else:
        existing = await db.users.find_one({"email": admin_email})
    if admin_email and not existing:
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
    elif admin_email:
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
        cat_ids = {}
        for index, c in enumerate(SEED_CATEGORIES):
            cid = str(uuid.uuid4())
            await db.categories.insert_one({
                "id": cid,
                "name": c["name"],
                "description": c.get("description", ""),
                "icon": c.get("icon", ""),
                "display_order": c.get("display_order", index),
                "created_at": iso(now_utc()),
            })
            cat_ids[c["name"]] = cid

        for index, product in enumerate(SEED_PRODUCTS):
            await db.products.insert_one({
                "id": str(uuid.uuid4()),
                "name": product["name"],
                "description": product["description"],
                "image_url": product["image_url"],
                "price": product["price"],
                "category_id": cat_ids[product["category_name"]],
                "available": True,
                "promo_active": product["promo_active"],
                "promo_price": product["promo_price"],
                "display_order": product.get("display_order", index),
                "option_groups": normalize_product_option_groups(product.get("option_groups", [])),
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
