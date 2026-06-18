import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parents[1]
PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"


def import_server(monkeypatch):
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))
    for name, value in {
        "APP_ENV": "development",
        "MONGO_URL": "mongodb://localhost:27017",
        "DB_NAME": "adega_delivery_test",
        "JWT_SECRET": "test-secret",
        "CLOUDINARY_CLOUD_NAME": "test-cloud",
        "CLOUDINARY_API_KEY": "test-key",
        "CLOUDINARY_API_SECRET": "test-secret",
    }.items():
        monkeypatch.setenv(name, value)
    sys.modules.pop("server", None)
    return importlib.import_module("server")


def valid_png_file():
    return {"file": ("product.png", PNG_BYTES, "image/png")}


def test_guest_cannot_upload_product_image(monkeypatch):
    server = import_server(monkeypatch)
    client = TestClient(server.app)

    response = client.post("/api/admin/products/upload-image", files=valid_png_file())

    assert response.status_code == 401


def test_customer_cannot_upload_product_image(monkeypatch):
    server = import_server(monkeypatch)
    server.app.dependency_overrides[server.get_current_user] = lambda: {
        "id": "customer-id",
        "role": "customer",
    }
    client = TestClient(server.app)

    response = client.post("/api/admin/products/upload-image", files=valid_png_file())

    assert response.status_code == 403
    server.app.dependency_overrides.clear()


def test_admin_can_upload_product_image(monkeypatch):
    server = import_server(monkeypatch)
    server.app.dependency_overrides[server.require_admin] = lambda: {
        "id": "admin-id",
        "role": "admin",
    }
    monkeypatch.setattr(
        server.cloudinary.uploader,
        "upload",
        lambda *args, **kwargs: {"secure_url": "https://res.cloudinary.com/demo/product.png"},
    )
    client = TestClient(server.app)

    response = client.post("/api/admin/products/upload-image", files=valid_png_file())

    assert response.status_code == 200
    assert response.json() == {"image_url": "https://res.cloudinary.com/demo/product.png"}
    server.app.dependency_overrides.clear()


def test_invalid_product_image_type_is_rejected(monkeypatch):
    server = import_server(monkeypatch)
    server.app.dependency_overrides[server.require_admin] = lambda: {
        "id": "admin-id",
        "role": "admin",
    }
    client = TestClient(server.app)

    response = client.post(
        "/api/admin/products/upload-image",
        files={"file": ("product.txt", b"not an image", "text/plain")},
    )

    assert response.status_code == 400
    assert "Tipo de arquivo inválido" in response.json()["detail"]
    server.app.dependency_overrides.clear()


def test_oversized_product_image_is_rejected(monkeypatch):
    server = import_server(monkeypatch)
    server.app.dependency_overrides[server.require_admin] = lambda: {
        "id": "admin-id",
        "role": "admin",
    }
    client = TestClient(server.app)

    response = client.post(
        "/api/admin/products/upload-image",
        files={
            "file": (
                "product.png",
                b"x" * (server.MAX_PRODUCT_IMAGE_BYTES + 1),
                "image/png",
            )
        },
    )

    assert response.status_code == 400
    assert "maior que o limite" in response.json()["detail"]
    server.app.dependency_overrides.clear()


def test_guest_cannot_upload_store_branding_image(monkeypatch):
    server = import_server(monkeypatch)
    client = TestClient(server.app)

    response = client.post(
        "/api/admin/store-settings/upload-image?image_type=logo",
        files=valid_png_file(),
    )

    assert response.status_code == 401


def test_admin_can_upload_store_banner(monkeypatch):
    server = import_server(monkeypatch)
    server.app.dependency_overrides[server.require_admin] = lambda: {
        "id": "admin-id",
        "role": "admin",
    }
    monkeypatch.setattr(
        server.cloudinary.uploader,
        "upload",
        lambda *args, **kwargs: {"secure_url": "https://res.cloudinary.com/demo/banner.png"},
    )
    client = TestClient(server.app)

    response = client.post(
        "/api/admin/store-settings/upload-image?image_type=banner",
        files=valid_png_file(),
    )

    assert response.status_code == 200
    assert response.json() == {
        "image_url": "https://res.cloudinary.com/demo/banner.png",
        "image_type": "banner",
    }
    server.app.dependency_overrides.clear()
