"""
Backend API tests for Adega Delivery (white-label).
Covers: auth, config, categories, products, orders, admin stats.
Uses public REACT_APP_BACKEND_URL with /api prefix.
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://winedelivery-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@adega.com"
ADMIN_PASSWORD = "admin123"


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body and body["user"]["role"] == "admin"
    return body["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def customer(s):
    """Create a fresh customer for tests."""
    email = f"e2e_customer_{uuid.uuid4().hex[:8]}@adega.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "E2E Customer", "email": email, "password": "teste123", "phone": "11999990000"
    })
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    return {"email": email, "password": "teste123", "token": body["access_token"], "user": body["user"]}


@pytest.fixture(scope="session")
def customer_headers(customer):
    return {"Authorization": f"Bearer {customer['token']}", "Content-Type": "application/json"}


# ---------------- public endpoints ----------------
class TestPublic:
    def test_config(self, s):
        r = s.get(f"{API}/config")
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "Adega do Vinho"
        assert d["whatsapp_number"] == "5511999990000"
        assert d["primary_color"].startswith("#")
        assert "pix_key" in d

    def test_categories_seed(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        names = {c["name"] for c in cats}
        for expected in ["Vinhos Tintos", "Vinhos Brancos", "Espumantes",
                         "Cervejas Especiais", "Destilados"]:
            assert expected in names, f"Missing seeded category {expected}"
        assert len(cats) >= 5

    def test_products_seed(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) >= 11
        for p in prods[:3]:
            assert "id" in p and "category_id" in p and "price" in p
            assert "image_url" in p
            assert "_id" not in p

    def test_product_by_id(self, s):
        prods = s.get(f"{API}/products").json()
        first = prods[0]
        r = s.get(f"{API}/products/{first['id']}")
        assert r.status_code == 200
        assert r.json()["id"] == first["id"]

    def test_product_search_malbec(self, s):
        r = s.get(f"{API}/products", params={"search": "Malbec"})
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) >= 1
        assert all("malbec" in p["name"].lower() for p in prods)

    def test_product_search_case_insensitive(self, s):
        r = s.get(f"{API}/products", params={"search": "malbec"})
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_product_filter_by_category(self, s):
        cats = s.get(f"{API}/categories").json()
        tintos = next(c for c in cats if c["name"] == "Vinhos Tintos")
        r = s.get(f"{API}/products", params={"category_id": tintos["id"]})
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) >= 1
        assert all(p["category_id"] == tintos["id"] for p in prods)


# ---------------- auth ----------------
class TestAuth:
    def test_login_admin(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["role"] == "admin"
        assert "access_token" in body
        # cookie should be set
        assert "access_token" in r.cookies or any("access_token" in c.name for c in r.cookies)

    def test_login_wrong(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_duplicate(self, s, customer):
        r = s.post(f"{API}/auth/register", json={
            "name": "Dup", "email": customer["email"], "password": "teste123"
        })
        assert r.status_code == 409

    def test_me_with_bearer(self, s, customer_headers, customer):
        r = requests.get(f"{API}/auth/me", headers=customer_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == customer["email"]
        assert "password_hash" not in u
        assert u["role"] == "customer"

    def test_me_unauthorized(self, s):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------------- admin guards ----------------
class TestAdminGuards:
    def test_create_category_unauth(self, s):
        r = requests.post(f"{API}/categories", json={"name": "X"})
        assert r.status_code == 401

    def test_create_product_unauth(self, s):
        r = requests.post(f"{API}/products", json={
            "name": "X", "price": 10, "category_id": "x"
        })
        assert r.status_code == 401

    def test_create_category_as_customer_403(self, customer_headers):
        r = requests.post(f"{API}/categories", json={"name": "X"}, headers=customer_headers)
        assert r.status_code == 403

    def test_orders_admin_endpoint_unauth(self):
        r = requests.get(f"{API}/orders")
        assert r.status_code == 401


# ---------------- admin CRUD ----------------
class TestAdminCRUD:
    def test_category_crud_and_product_crud_and_delete_block(self, admin_headers):
        # CREATE category
        cname = f"TEST_cat_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/categories", json={"name": cname, "description": "t"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        cat = r.json()
        cid = cat["id"]

        # UPDATE category
        r = requests.put(f"{API}/categories/{cid}", json={"name": cname + "_u"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["name"] == cname + "_u"

        # CREATE product under category
        r = requests.post(f"{API}/products", json={
            "name": f"TEST_prod_{uuid.uuid4().hex[:6]}",
            "description": "t", "image_url": "https://x.test/i.jpg",
            "price": 12.5, "category_id": cid,
            "available": True, "promo_active": True, "promo_price": 9.9,
        }, headers=admin_headers)
        assert r.status_code == 200, r.text
        prod = r.json()
        pid = prod["id"]
        assert prod["promo_active"] is True and prod["promo_price"] == 9.9

        # GET product
        r = requests.get(f"{API}/products/{pid}")
        assert r.status_code == 200

        # Cannot delete category with product
        r = requests.delete(f"{API}/categories/{cid}", headers=admin_headers)
        assert r.status_code == 400

        # UPDATE product
        r = requests.put(f"{API}/products/{pid}", json={
            "name": "TEST_prod_updated", "price": 15.0, "category_id": cid,
            "available": True, "promo_active": False, "promo_price": None,
            "description": "", "image_url": "",
        }, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_prod_updated"

        # DELETE product, then category
        r = requests.delete(f"{API}/products/{pid}", headers=admin_headers)
        assert r.status_code == 200
        r = requests.get(f"{API}/products/{pid}")
        assert r.status_code == 404

        r = requests.delete(f"{API}/categories/{cid}", headers=admin_headers)
        assert r.status_code == 200


# ---------------- orders ----------------
class TestOrders:
    def _sample_items(self, s):
        prods = s.get(f"{API}/products").json()
        p = prods[0]
        return [{"product_id": p["id"], "name": p["name"], "quantity": 2, "unit_price": p["price"]}]

    def test_guest_order(self, s):
        items = self._sample_items(s)
        r = requests.post(f"{API}/orders", json={
            "customer_name": "Guest",
            "customer_phone": "11999991111",
            "customer_address": "Rua A, 1",
            "payment_method": "pix",
            "items": items,
            "observations": "sem urgência"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "recebido"
        assert d["user_id"] is None
        assert d["total"] == round(items[0]["unit_price"] * 2, 2)

    def test_empty_items_400(self):
        r = requests.post(f"{API}/orders", json={
            "customer_name": "G", "customer_phone": "11", "customer_address": "x",
            "payment_method": "pix", "items": [], "observations": ""
        })
        assert r.status_code == 400

    def test_invalid_payment_422(self):
        r = requests.post(f"{API}/orders", json={
            "customer_name": "G", "customer_phone": "11", "customer_address": "x",
            "payment_method": "boleto", "items": [{"product_id": "a", "name": "b", "quantity": 1, "unit_price": 1.0}]
        })
        assert r.status_code == 422

    def test_my_orders_isolation(self, s, customer_headers, customer):
        items = self._sample_items(s)
        # place order as customer
        r = requests.post(f"{API}/orders", json={
            "customer_name": customer["user"]["name"],
            "customer_phone": "1199",
            "customer_address": "Rua B, 2",
            "payment_method": "dinheiro",
            "items": items, "observations": ""
        }, headers=customer_headers)
        assert r.status_code == 200
        oid = r.json()["id"]

        # /orders/mine
        r = requests.get(f"{API}/orders/mine", headers=customer_headers)
        assert r.status_code == 200
        mine = r.json()
        assert any(o["id"] == oid for o in mine)
        assert all(o["user_id"] == customer["user"]["id"] for o in mine)

    def test_admin_orders_and_status_update(self, s, admin_headers):
        items = self._sample_items(s)
        r = requests.post(f"{API}/orders", json={
            "customer_name": "Z", "customer_phone": "1", "customer_address": "z",
            "payment_method": "cartao", "items": items
        })
        oid = r.json()["id"]

        r = requests.get(f"{API}/orders", headers=admin_headers)
        assert r.status_code == 200
        orders = r.json()
        # check sort desc
        ts = [o["created_at"] for o in orders]
        assert ts == sorted(ts, reverse=True)

        # update status valid
        r = requests.patch(f"{API}/orders/{oid}/status",
                           json={"status": "em_preparo"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "em_preparo"

        # invalid status
        r = requests.patch(f"{API}/orders/{oid}/status",
                           json={"status": "invalid"}, headers=admin_headers)
        assert r.status_code == 422


# ---------------- admin stats ----------------
class TestAdminStats:
    def test_stats(self, admin_headers):
        r = requests.get(f"{API}/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for key in ("total_orders", "total_products", "total_categories", "revenue", "orders_by_status"):
            assert key in d
        assert d["total_categories"] >= 5
        assert d["total_products"] >= 11
        assert isinstance(d["orders_by_status"], dict)
