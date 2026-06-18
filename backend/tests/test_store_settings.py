"""Tests for public and administrative store branding settings."""

import importlib
import sys
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parents[1]


class FakeStoreSettingsCollection:
    def __init__(self):
        self.document = None

    async def find_one(self, query):
        if not self.document:
            return None
        return dict(self.document)

    async def update_one(self, query, update, upsert=False):
        self.document = {"_id": query["_id"], **update["$set"]}
        return SimpleNamespace(matched_count=1, upserted_id=query["_id"])


def import_server(monkeypatch):
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))
    for name, value in {
        "APP_ENV": "development",
        "MONGO_URL": "mongodb://localhost:27017",
        "DB_NAME": "store_settings_test",
        "JWT_SECRET": "test-secret",
    }.items():
        monkeypatch.setenv(name, value)
    sys.modules.pop("server", None)
    return importlib.import_module("server")


def configure_fake_db(server):
    collection = FakeStoreSettingsCollection()
    server.db = SimpleNamespace(store_settings=collection)
    return collection


def branding_payload():
    return {
        "store_name": "Loja de Teste",
        "store_logo_url": "https://example.com/logo.png",
        "store_banner_url": "https://example.com/banner.jpg",
        "banner_title": "Título do banner",
        "banner_subtitle": "Subtítulo do banner",
        "banner_button_text": "Ver ofertas",
        "banner_button_link": "/#produtos",
        "banner_enabled": True,
    }


def test_public_config_uses_white_label_fallbacks(monkeypatch):
    server = import_server(monkeypatch)
    configure_fake_db(server)
    client = TestClient(server.app)

    response = client.get("/api/config")

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == server.STORE_CONFIG["name"]
    assert data["banner_url"] == server.STORE_CONFIG["banner_url"]
    assert data["store_banner_url"] == server.STORE_CONFIG["banner_url"]


def test_store_settings_update_requires_authentication(monkeypatch):
    server = import_server(monkeypatch)
    configure_fake_db(server)
    client = TestClient(server.app)

    response = client.put("/api/admin/store-settings", json=branding_payload())

    assert response.status_code == 401


def test_admin_updates_and_persists_visual_settings(monkeypatch):
    server = import_server(monkeypatch)
    collection = configure_fake_db(server)
    server.app.dependency_overrides[server.require_admin] = lambda: {
        "id": "admin-id",
        "role": "admin",
    }
    client = TestClient(server.app)

    update_response = client.put(
        "/api/admin/store-settings",
        json=branding_payload(),
    )
    public_response = client.get("/api/config")

    assert update_response.status_code == 200
    assert public_response.status_code == 200
    assert collection.document["store_name"] == "Loja de Teste"
    assert collection.document["store_logo_url"] == "https://example.com/logo.png"
    assert collection.document["store_banner_url"] == "https://example.com/banner.jpg"
    public = public_response.json()
    assert public["name"] == "Loja de Teste"
    assert public["logo_url"] == "https://example.com/logo.png"
    assert public["banner_url"] == "https://example.com/banner.jpg"
    assert public["banner_title"] == "Título do banner"
    assert public["banner_button_link"] == "/#produtos"
    server.app.dependency_overrides.clear()
