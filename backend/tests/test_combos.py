"""Integration tests for combo pricing, availability and order persistence."""

import os
import uuid

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")


@pytest.fixture(scope="session")
def admin_headers():
    if not ADMIN_PASSWORD:
        pytest.skip("ADMIN_PASSWORD is required for combo integration tests")
    response = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return {
        "Authorization": f"Bearer {response.json()['access_token']}",
        "Content-Type": "application/json",
    }


def create_product(admin_headers, *, available=True):
    categories = requests.get(f"{API}/categories").json()
    response = requests.post(
        f"{API}/products",
        headers=admin_headers,
        json={
            "name": f"Combo product {uuid.uuid4().hex[:8]}",
            "description": "",
            "image_url": "",
            "price": 80.0,
            "category_id": categories[0]["id"],
            "available": available,
            "promo_active": False,
            "promo_price": None,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def create_combo(admin_headers, product_id, *, price=99.9):
    response = requests.post(
        f"{API}/admin/combos",
        headers=admin_headers,
        json={
            "name": f"Combo test {uuid.uuid4().hex[:8]}",
            "description": "Combo integration test",
            "image_url": "",
            "products": [{"product_id": product_id, "quantity": 2}],
            "promotional_price": price,
            "active": True,
            "display_order": 1,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def delete_test_data(admin_headers, combo_id, product_id):
    requests.delete(f"{API}/admin/combos/{combo_id}", headers=admin_headers)
    requests.delete(f"{API}/products/{product_id}", headers=admin_headers)


def test_combo_order_uses_backend_price_and_persists_snapshot(admin_headers):
    product = create_product(admin_headers)
    combo = create_combo(admin_headers, product["id"], price=99.9)
    try:
        response = requests.post(
            f"{API}/orders",
            json={
                "customer_name": "Combo Customer",
                "customer_phone": "11999990000",
                "customer_address": "Rua Combo, 1",
                "payment_method": "pix",
                "fulfillment_type": "pickup",
                "items": [{
                    "item_type": "combo",
                    "combo_id": combo["id"],
                    "quantity": 2,
                    "unit_price": 0.01,
                    "total": 0.02,
                }],
            },
        )
        assert response.status_code == 200, response.text
        order = response.json()
        item = order["items"][0]
        assert item["item_type"] == "combo"
        assert item["combo_id"] == combo["id"]
        assert item["unit_price"] == 99.9
        assert item["quantity"] == 2
        assert item["combo_items"][0]["product_id"] == product["id"]
        assert item["combo_items"][0]["quantity"] == 2
        assert order["subtotal"] == 199.8
    finally:
        delete_test_data(admin_headers, combo["id"], product["id"])


def test_combo_with_unavailable_product_is_hidden_and_blocked(admin_headers):
    product = create_product(admin_headers, available=False)
    combo = create_combo(admin_headers, product["id"])
    try:
        public_combos = requests.get(f"{API}/combos").json()
        assert combo["id"] not in {item["id"] for item in public_combos}

        response = requests.post(
            f"{API}/orders",
            json={
                "customer_name": "Combo Customer",
                "customer_phone": "11999990000",
                "customer_address": "Rua Combo, 1",
                "payment_method": "pix",
                "fulfillment_type": "pickup",
                "items": [{
                    "item_type": "combo",
                    "combo_id": combo["id"],
                    "quantity": 1,
                }],
            },
        )
        assert response.status_code == 400
        assert "indispon" in response.json()["detail"].lower()
    finally:
        delete_test_data(admin_headers, combo["id"], product["id"])


def test_inactive_combo_cannot_be_purchased(admin_headers):
    product = create_product(admin_headers)
    combo = create_combo(admin_headers, product["id"])
    try:
        update = requests.put(
            f"{API}/admin/combos/{combo['id']}",
            headers=admin_headers,
            json={
                "name": combo["name"],
                "description": combo["description"],
                "image_url": combo["image_url"],
                "products": combo["products"],
                "promotional_price": combo["promotional_price"],
                "active": False,
                "display_order": combo["display_order"],
            },
        )
        assert update.status_code == 200, update.text

        response = requests.post(
            f"{API}/orders",
            json={
                "customer_name": "Combo Customer",
                "customer_phone": "11999990000",
                "customer_address": "Rua Combo, 1",
                "payment_method": "pix",
                "fulfillment_type": "pickup",
                "items": [{
                    "item_type": "combo",
                    "combo_id": combo["id"],
                    "quantity": 1,
                }],
            },
        )
        assert response.status_code == 400
        assert "indispon" in response.json()["detail"].lower()
    finally:
        delete_test_data(admin_headers, combo["id"], product["id"])
