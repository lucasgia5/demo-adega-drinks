"""
Backend API tests for iteration 2: Delivery Areas + Order delivery fee/min_order/active.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://winedelivery-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@adega.com"
ADMIN_PASSWORD = "admin123"


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def admin_headers(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def customer_headers(s):
    email = f"e2e_iter2_{uuid.uuid4().hex[:8]}@adega.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "E2E Iter2", "email": email, "password": "teste123", "phone": "11999990000"
    })
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def first_product(s):
    prods = s.get(f"{API}/products").json()
    return prods[0]


# Track created area ids for cleanup
_created_ids = []


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_areas(admin_headers):
    yield
    for aid in _created_ids:
        try:
            requests.delete(f"{API}/admin/delivery-areas/{aid}", headers=admin_headers)
        except Exception:
            pass


# ---------------- Public listing ----------------
class TestPublicDeliveryAreas:
    def test_public_list_only_active_sorted(self, s):
        r = s.get(f"{API}/delivery-areas")
        assert r.status_code == 200
        areas = r.json()
        # All should be active
        for a in areas:
            assert a.get("active") is True
            assert "_id" not in a
            assert "id" in a and "name" in a and "fee" in a
        # Sorted by name (case sensitive sort matches backend)
        names = [a["name"] for a in areas]
        assert names == sorted(names)
        # Seeded names exist
        names_set = set(names)
        for expected in ["Centro", "Jardins", "Moema", "Pinheiros", "Vila Madalena"]:
            assert expected in names_set, f"Missing seeded area {expected}"


# ---------------- Admin guards ----------------
class TestAdminDeliveryAreasGuards:
    def test_admin_list_unauth(self):
        r = requests.get(f"{API}/admin/delivery-areas")
        assert r.status_code == 401

    def test_admin_list_as_customer_403(self, customer_headers):
        r = requests.get(f"{API}/admin/delivery-areas", headers=customer_headers)
        assert r.status_code == 403

    def test_admin_create_unauth(self):
        r = requests.post(f"{API}/admin/delivery-areas", json={"name": "X", "fee": 1})
        assert r.status_code == 401

    def test_admin_create_as_customer_403(self, customer_headers):
        r = requests.post(
            f"{API}/admin/delivery-areas",
            json={"name": "X", "fee": 1},
            headers=customer_headers,
        )
        assert r.status_code == 403


# ---------------- Admin CRUD ----------------
class TestAdminDeliveryAreasCRUD:
    def test_admin_list_includes_inactive(self, admin_headers):
        # Create an inactive area
        name = f"TEST_inactive_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/admin/delivery-areas", json={
            "name": name, "fee": 5.5, "min_order": None, "active": False,
        }, headers=admin_headers)
        assert r.status_code == 200, r.text
        area = r.json()
        _created_ids.append(area["id"])

        # Admin list should include it
        r = requests.get(f"{API}/admin/delivery-areas", headers=admin_headers)
        assert r.status_code == 200
        all_areas = r.json()
        match = [a for a in all_areas if a["id"] == area["id"]]
        assert len(match) == 1
        assert match[0]["active"] is False

        # Public list should NOT include it
        r = requests.get(f"{API}/delivery-areas")
        pub_ids = [a["id"] for a in r.json()]
        assert area["id"] not in pub_ids

    def test_create_with_min_order_null(self, admin_headers):
        name = f"TEST_nullmin_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/admin/delivery-areas", json={
            "name": name, "fee": 10.0, "active": True,
        }, headers=admin_headers)
        assert r.status_code == 200, r.text
        a = r.json()
        _created_ids.append(a["id"])
        assert a["name"] == name
        assert a["fee"] == 10.0
        assert a["min_order"] is None
        assert a["active"] is True
        assert "id" in a and "_id" not in a

    def test_update_area_fields(self, admin_headers):
        name = f"TEST_upd_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/admin/delivery-areas", json={
            "name": name, "fee": 9.0, "min_order": 30, "active": True,
        }, headers=admin_headers)
        assert r.status_code == 200
        aid = r.json()["id"]
        _created_ids.append(aid)

        r = requests.put(f"{API}/admin/delivery-areas/{aid}", json={
            "name": name + "_u", "fee": 11.5, "min_order": 40, "active": False,
        }, headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == name + "_u"
        assert d["fee"] == 11.5
        assert d["min_order"] == 40.0
        assert d["active"] is False

        # Verify via admin list (persistence)
        r = requests.get(f"{API}/admin/delivery-areas", headers=admin_headers)
        found = [a for a in r.json() if a["id"] == aid][0]
        assert found["fee"] == 11.5 and found["active"] is False

    def test_delete_area(self, admin_headers):
        name = f"TEST_del_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/admin/delivery-areas", json={
            "name": name, "fee": 7.0, "active": True,
        }, headers=admin_headers)
        aid = r.json()["id"]

        r = requests.delete(f"{API}/admin/delivery-areas/{aid}", headers=admin_headers)
        assert r.status_code == 200

        # Confirm gone
        r = requests.get(f"{API}/admin/delivery-areas", headers=admin_headers)
        ids = [a["id"] for a in r.json()]
        assert aid not in ids

        # Delete again -> 404
        r = requests.delete(f"{API}/admin/delivery-areas/{aid}", headers=admin_headers)
        assert r.status_code == 404


# ---------------- Orders + delivery area ----------------
class TestOrdersWithDeliveryArea:
    def _items(self, prod, qty=1, unit_price=None):
        return [{
            "product_id": prod["id"],
            "name": prod["name"],
            "quantity": qty,
            "unit_price": unit_price if unit_price is not None else prod["price"],
        }]

    def test_order_with_valid_area_computes_total(self, s, first_product):
        # Use Jardins (fee 12, min 50)
        areas = s.get(f"{API}/delivery-areas").json()
        jardins = next(a for a in areas if a["name"] == "Jardins")
        items = self._items(first_product, qty=1, unit_price=80.0)  # subtotal 80 > min 50
        r = requests.post(f"{API}/orders", json={
            "customer_name": "Test",
            "customer_phone": "11999990000",
            "customer_address": "Rua X, 1",
            "payment_method": "pix",
            "delivery_area_id": jardins["id"],
            "items": items,
            "observations": "",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["delivery_area_id"] == jardins["id"]
        assert d["delivery_area_name"] == "Jardins"
        assert d["delivery_fee"] == 12.0
        assert d["subtotal"] == 80.0
        assert d["total"] == 80.0 + 12.0

    def test_order_with_inactive_area_400(self, admin_headers, first_product):
        # Create inactive area
        name = f"TEST_inact_order_{uuid.uuid4().hex[:6]}"
        ra = requests.post(f"{API}/admin/delivery-areas", json={
            "name": name, "fee": 9.9, "active": False,
        }, headers=admin_headers)
        assert ra.status_code == 200
        aid = ra.json()["id"]
        _created_ids.append(aid)

        items = self._items(first_product, qty=1, unit_price=100.0)
        r = requests.post(f"{API}/orders", json={
            "customer_name": "Test",
            "customer_phone": "11999990000",
            "customer_address": "Rua X, 1",
            "payment_method": "pix",
            "delivery_area_id": aid,
            "items": items,
        })
        assert r.status_code == 400
        assert "indisponível" in r.json().get("detail", "").lower() or "indispon" in r.json().get("detail", "").lower()

    def test_order_with_nonexistent_area_400(self, first_product):
        items = self._items(first_product, qty=1, unit_price=50.0)
        r = requests.post(f"{API}/orders", json={
            "customer_name": "Test",
            "customer_phone": "11999990000",
            "customer_address": "Rua X, 1",
            "payment_method": "pix",
            "delivery_area_id": str(uuid.uuid4()),
            "items": items,
        })
        assert r.status_code == 400
        assert "inválida" in r.json().get("detail", "").lower() or "inv" in r.json().get("detail", "").lower()

    def test_order_below_min_order_400(self, s, first_product):
        # Moema fee 18, min 80
        areas = s.get(f"{API}/delivery-areas").json()
        moema = next(a for a in areas if a["name"] == "Moema")
        items = self._items(first_product, qty=1, unit_price=10.0)  # subtotal 10 < 80
        r = requests.post(f"{API}/orders", json={
            "customer_name": "Test",
            "customer_phone": "11999990000",
            "customer_address": "Rua X, 1",
            "payment_method": "pix",
            "delivery_area_id": moema["id"],
            "items": items,
        })
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "Pedido mínimo" in detail
        assert "Moema" in detail

    def test_order_without_area_backward_compat(self, first_product):
        items = self._items(first_product, qty=2, unit_price=25.0)
        r = requests.post(f"{API}/orders", json={
            "customer_name": "Test",
            "customer_phone": "11999990000",
            "customer_address": "Rua X, 1",
            "payment_method": "pix",
            "items": items,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("delivery_area_id") in (None, "")
        assert d.get("delivery_area_name", "") == ""
        assert d["delivery_fee"] == 0
        assert d["subtotal"] == 50.0
        assert d["total"] == 50.0
