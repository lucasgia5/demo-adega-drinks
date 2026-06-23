import importlib
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def import_server(monkeypatch):
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))
    for name, value in {
        "APP_ENV": "development",
        "MONGO_URL": "mongodb://localhost:27017",
        "DB_NAME": "adega_delivery_test",
        "JWT_SECRET": "test-secret",
    }.items():
        monkeypatch.setenv(name, value)
    sys.modules.pop("server", None)
    return importlib.import_module("server")


def test_product_order_falls_back_to_newest_first(monkeypatch):
    server = import_server(monkeypatch)
    docs = [
        {"id": "old", "created_at": "2026-01-01T10:00:00Z"},
        {"id": "new", "created_at": "2026-01-02T10:00:00Z"},
    ]

    ordered = server.sort_catalog_docs(docs, "products")

    assert [doc["id"] for doc in ordered] == ["new", "old"]


def test_display_order_takes_priority_after_manual_reorder(monkeypatch):
    server = import_server(monkeypatch)
    docs = [
        {"id": "old", "display_order": 0, "created_at": "2026-01-01T10:00:00Z"},
        {"id": "new", "display_order": 1, "created_at": "2026-01-02T10:00:00Z"},
    ]

    ordered = server.sort_catalog_docs(docs, "products")

    assert [doc["id"] for doc in ordered] == ["old", "new"]


def test_category_order_falls_back_to_current_name_sort(monkeypatch):
    server = import_server(monkeypatch)
    docs = [
        {"id": "vodka", "name": "Vodka"},
        {"id": "dose", "name": "Dose"},
    ]

    ordered = server.sort_catalog_docs(docs, "categories")

    assert [doc["id"] for doc in ordered] == ["dose", "vodka"]
