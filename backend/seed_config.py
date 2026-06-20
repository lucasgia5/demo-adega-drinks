"""
Initial catalog seed data for the Adega Drinks demo store.

The seed only runs when the categories collection is empty. Existing catalog
data is never removed automatically.
"""

SEED_CATEGORIES = [
    {"name": "Dose", "icon": "glass"},
    {"name": "Garrafas", "icon": "wine"},
    {"name": "Combos", "icon": "package"},
]

SEED_PRODUCTS = [
    {
        "name": "Dose de vodka com energético",
        "description": "Dose de vodka servida com energético.",
        "category_name": "Dose",
        "price": 15.00,
        "promo_active": False,
        "promo_price": None,
        "image_url": "",
    },
    {
        "name": "Dose de whisky com energético",
        "description": "Dose de whisky servida com energético.",
        "category_name": "Dose",
        "price": 15.00,
        "promo_active": False,
        "promo_price": None,
        "image_url": "",
    },
    {
        "name": "Dose de gin com energético",
        "description": "Dose de gin servida com energético.",
        "category_name": "Dose",
        "price": 15.00,
        "promo_active": True,
        "promo_price": 10.00,
        "image_url": "",
    },
    {
        "name": "Garrafa de Red Label 1L",
        "description": "Garrafa de whisky Red Label de 1 litro.",
        "category_name": "Garrafas",
        "price": 110.00,
        "promo_active": False,
        "promo_price": None,
        "image_url": "",
    },
    {
        "name": "Garrafa de Smirnoff 1.7L",
        "description": "Garrafa de vodka Smirnoff de 1,7 litro.",
        "category_name": "Garrafas",
        "price": 40.00,
        "promo_active": False,
        "promo_price": None,
        "image_url": "",
    },
    {
        "name": "Combo de Red Label + 4 latas de energético + 2 gelos de coco",
        "description": "Combo com uma garrafa de Red Label, quatro latas de energético e dois gelos de coco.",
        "category_name": "Combos",
        "price": 170.00,
        "promo_active": False,
        "promo_price": None,
        "image_url": "",
    },
]
