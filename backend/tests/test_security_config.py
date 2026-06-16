import importlib
import sys
from pathlib import Path

import pytest


BACKEND_DIR = Path(__file__).resolve().parents[1]


def import_server(monkeypatch, **env):
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))
    for name in (
        "APP_ENV",
        "ENV",
        "MONGO_URL",
        "DB_NAME",
        "JWT_SECRET",
        "ADMIN_EMAIL",
        "ADMIN_PASSWORD",
        "FRONTEND_URL",
    ):
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    sys.modules.pop("server", None)
    return importlib.import_module("server")


def test_production_requires_jwt_secret(monkeypatch):
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        import_server(
            monkeypatch,
            APP_ENV="production",
            MONGO_URL="mongodb://localhost:27017",
            DB_NAME="adega_delivery_test",
            ADMIN_EMAIL="admin@example.com",
            ADMIN_PASSWORD="strong-password",
            FRONTEND_URL="https://shop.example.com",
        )


def test_production_requires_admin_credentials(monkeypatch):
    with pytest.raises(RuntimeError, match="ADMIN_EMAIL"):
        import_server(
            monkeypatch,
            APP_ENV="production",
            MONGO_URL="mongodb://localhost:27017",
            DB_NAME="adega_delivery_test",
            JWT_SECRET="test-secret",
            FRONTEND_URL="https://shop.example.com",
        )


def test_production_cors_uses_frontend_url(monkeypatch):
    server = import_server(
        monkeypatch,
        APP_ENV="production",
        MONGO_URL="mongodb://localhost:27017",
        DB_NAME="adega_delivery_test",
        JWT_SECRET="test-secret",
        ADMIN_EMAIL="admin@example.com",
        ADMIN_PASSWORD="strong-password",
        FRONTEND_URL="https://shop.example.com",
    )

    assert server.get_frontend_origins() == ["https://shop.example.com"]


def test_production_rejects_http_frontend_url(monkeypatch):
    with pytest.raises(RuntimeError, match="https"):
        import_server(
            monkeypatch,
            APP_ENV="production",
            MONGO_URL="mongodb://localhost:27017",
            DB_NAME="adega_delivery_test",
            JWT_SECRET="test-secret",
            ADMIN_EMAIL="admin@example.com",
            ADMIN_PASSWORD="strong-password",
            FRONTEND_URL="http://shop.example.com",
        )


def test_development_cors_defaults_to_localhost(monkeypatch):
    server = import_server(
        monkeypatch,
        APP_ENV="development",
        MONGO_URL="mongodb://localhost:27017",
        DB_NAME="adega_delivery_test",
        JWT_SECRET="test-secret",
    )

    assert server.get_frontend_origins() == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def test_cookie_settings_are_secure_in_production(monkeypatch):
    server = import_server(
        monkeypatch,
        APP_ENV="production",
        MONGO_URL="mongodb://localhost:27017",
        DB_NAME="adega_delivery_test",
        JWT_SECRET="test-secret",
        ADMIN_EMAIL="admin@example.com",
        ADMIN_PASSWORD="strong-password",
        FRONTEND_URL="https://shop.example.com",
    )

    assert server.get_cookie_settings() == {
        "httponly": True,
        "secure": True,
        "samesite": "none",
        "path": "/",
    }


def test_cookie_settings_are_local_dev_friendly(monkeypatch):
    server = import_server(
        monkeypatch,
        APP_ENV="development",
        MONGO_URL="mongodb://localhost:27017",
        DB_NAME="adega_delivery_test",
        JWT_SECRET="test-secret",
    )

    assert server.get_cookie_settings() == {
        "httponly": True,
        "secure": False,
        "samesite": "lax",
        "path": "/",
    }
