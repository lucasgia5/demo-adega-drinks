import os
import sys
import uuid
from pathlib import Path

import pytest
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@adega.com"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")


@pytest.fixture(scope="session")
def session():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_headers(session):
    if not ADMIN_PASSWORD:
        pytest.skip("ADMIN_PASSWORD must be set to run admin integration tests")
    try:
        response = session.post(
            f"{API}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
    except requests.ConnectionError:
        pytest.skip(f"Backend API is not running at {API}")
    assert response.status_code == 200, response.text
    return {
        "Authorization": f"Bearer {response.json()['access_token']}",
        "Content-Type": "application/json",
    }


@pytest.fixture()
def category(admin_headers):
    response = requests.post(
        f"{API}/categories",
        json={"name": f"TEST_options_cat_{uuid.uuid4().hex[:6]}"},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    category_doc = response.json()
    yield category_doc
    requests.delete(f"{API}/categories/{category_doc['id']}", headers=admin_headers)


def create_product(admin_headers, category_id, **overrides):
    payload = {
        "name": f"TEST_options_prod_{uuid.uuid4().hex[:6]}",
        "description": "product options",
        "image_url": "https://x.test/options.jpg",
        "price": 20.0,
        "category_id": category_id,
        "available": True,
        "promo_active": False,
        "promo_price": None,
    }
    payload.update(overrides)
    response = requests.post(f"{API}/products", json=payload, headers=admin_headers)
    assert response.status_code == 200, response.text
    return response.json()


def delete_product(admin_headers, product_id):
    requests.delete(f"{API}/products/{product_id}", headers=admin_headers)


def place_pickup_order(product_id, **item_overrides):
    item = {
        "item_type": "product",
        "product_id": product_id,
        "quantity": 1,
    }
    item.update(item_overrides)
    return requests.post(
        f"{API}/orders",
        json={
            "customer_name": "Options Customer",
            "customer_phone": "11999990000",
            "customer_address": "Retirada",
            "payment_method": "pix",
            "fulfillment_type": "pickup",
            "items": [item],
        },
    )


def test_product_without_option_groups_defaults_to_empty(admin_headers, category):
    product = create_product(admin_headers, category["id"])
    try:
        assert product["option_groups"] == []

        response = requests.get(f"{API}/products/{product['id']}")
        assert response.status_code == 200, response.text
        assert response.json()["option_groups"] == []
    finally:
        delete_product(admin_headers, product["id"])


def test_product_with_required_group_blocks_order_without_selection(admin_headers, category):
    product = create_product(
        admin_headers,
        category["id"],
        option_groups=[
            {
                "name": "Escolha uma opção",
                "required": True,
                "min_selections": 1,
                "max_selections": 1,
                "selection_type": "single",
                "order": 0,
                "active": True,
                "options": [{"name": "Opção A", "additional_price": 0, "max_quantity": 1}],
            }
        ],
    )
    try:
        assert product["option_groups"][0]["id"]
        assert product["option_groups"][0]["options"][0]["id"]

        response = place_pickup_order(product["id"])
        assert response.status_code == 400
    finally:
        delete_product(admin_headers, product["id"])


def test_paid_option_group_uses_backend_additional_price(admin_headers, category):
    product = create_product(
        admin_headers,
        category["id"],
        price=30.0,
        option_groups=[
            {
                "name": "Adicional",
                "required": False,
                "min_selections": 0,
                "max_selections": 1,
                "selection_type": "single",
                "order": 0,
                "active": True,
                "options": [{"name": "Extra", "additional_price": 7.5, "max_quantity": 1}],
            }
        ],
    )
    try:
        group = product["option_groups"][0]
        option = group["options"][0]
        response = place_pickup_order(
            product["id"],
            selected_options=[
                {
                    "group_id": group["id"],
                    "option_id": option["id"],
                    "quantity": 1,
                    "additional_price": 0.01,
                }
            ],
            unit_price=0.01,
        )
        assert response.status_code == 200, response.text
        order = response.json()
        item = order["items"][0]
        assert item["unit_price"] == 37.5
        assert item["selected_options"][0]["additional_price"] == 7.5
        assert order["subtotal"] == 37.5
    finally:
        delete_product(admin_headers, product["id"])


def test_option_group_minimum_and_maximum_are_validated(admin_headers, category):
    invalid = requests.post(
        f"{API}/products",
        json={
            "name": f"TEST_invalid_options_{uuid.uuid4().hex[:6]}",
            "description": "",
            "image_url": "",
            "price": 10,
            "category_id": category["id"],
            "available": True,
            "promo_active": False,
            "promo_price": None,
            "option_groups": [
                {
                    "name": "Invalid",
                    "min_selections": 2,
                    "max_selections": 1,
                    "selection_type": "multiple",
                    "options": [{"name": "A"}],
                }
            ],
        },
        headers=admin_headers,
    )
    assert invalid.status_code == 422

    product = create_product(
        admin_headers,
        category["id"],
        option_groups=[
            {
                "name": "Escolha até duas",
                "required": True,
                "min_selections": 1,
                "max_selections": 2,
                "selection_type": "multiple",
                "options": [
                    {"name": "A", "additional_price": 0, "order": 0},
                    {"name": "B", "additional_price": 0, "order": 1},
                    {"name": "C", "additional_price": 0, "order": 2},
                ],
            }
        ],
    )
    try:
        group = product["option_groups"][0]
        too_many = place_pickup_order(
            product["id"],
            selected_options=[
                {"group_id": group["id"], "option_id": option["id"]}
                for option in group["options"]
            ],
        )
        assert too_many.status_code == 400
    finally:
        delete_product(admin_headers, product["id"])


def test_legacy_product_without_option_groups_is_response_compatible():
    legacy = {
        "id": "legacy-product",
        "name": "Legacy",
        "price": 10,
        "category_id": "cat",
    }

    assert server.with_sorted_product_options(legacy)["option_groups"] == []


def test_option_group_schema_rejects_invalid_minimum_and_maximum():
    with pytest.raises(ValueError):
        server.ProductOptionGroupIn(
            name="Invalid",
            min_selections=2,
            max_selections=1,
            options=[server.ProductOptionIn(name="A")],
        )


def test_required_group_validation_without_selection_direct():
    product = {
        "id": "product-with-required-options",
        "price": 20,
        "option_groups": [
            {
                "id": "group-required",
                "name": "Required",
                "required": True,
                "min_selections": 1,
                "max_selections": 1,
                "selection_type": "single",
                "active": True,
                "options": [
                    {
                        "id": "option-a",
                        "name": "A",
                        "additional_price": 0,
                        "max_quantity": 1,
                        "active": True,
                    }
                ],
            }
        ],
    }

    with pytest.raises(server.HTTPException):
        server.resolve_selected_product_options(product, [])


def test_paid_option_uses_backend_price_direct():
    product = {
        "id": "product-with-paid-options",
        "price": 30,
        "option_groups": [
            {
                "id": "group-paid",
                "name": "Paid",
                "required": False,
                "min_selections": 0,
                "max_selections": 1,
                "selection_type": "single",
                "active": True,
                "options": [
                    {
                        "id": "option-extra",
                        "name": "Extra",
                        "additional_price": 7.5,
                        "max_quantity": 1,
                        "active": True,
                    }
                ],
            }
        ],
    }

    selected, additional_total = server.resolve_selected_product_options(
        product,
        [
            server.SelectedProductOptionIn(
                group_id="group-paid",
                option_id="option-extra",
                quantity=1,
            )
        ],
    )

    assert additional_total == 7.5
    assert selected[0].additional_price == 7.5
    assert selected[0].option_name == "Extra"
