"""
Initial catalog seed data.

For a new white-label store, replace the categories and products below before
the first production startup. The seed only runs when the categories collection
is empty.
"""

SEED_CATEGORIES = [
    {"name": "Vinhos Tintos", "icon": "wine"},
    {"name": "Vinhos Brancos", "icon": "wine"},
    {"name": "Espumantes", "icon": "wine"},
    {"name": "Cervejas Especiais", "icon": "beer"},
    {"name": "Destilados", "icon": "glass"},
]

SAMPLE_IMAGE_1 = (
    "https://images.unsplash.com/photo-1695048475597-08d65f119252"
    "?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHw0fHx3aW5lJTIwYm90dGxlJTIwcHJlbWl1bXxlbnwwfHx8fDE3ODE1MzM0OTF8MA&ixlib=rb-4.1.0&q=85"
)
SAMPLE_IMAGE_2 = (
    "https://images.unsplash.com/photo-1695048475751-5d3b5077d631"
    "?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwzfHx3aW5lJTIwYm90dGxlJTIwcHJlbWl1bXxlbnwwfHx8fDE3ODE1MzM0OTF8MA&ixlib=rb-4.1.0&q=85"
)

SEED_PRODUCTS = [
    {
        "name": "Cabernet Sauvignon Reserva",
        "description": "Vinho tinto encorpado com notas de carvalho e frutas vermelhas.",
        "category_name": "Vinhos Tintos",
        "price": 89.90,
        "promo_active": True,
        "promo_price": 64.90,
        "image_url": SAMPLE_IMAGE_1,
    },
    {
        "name": "Malbec Argentino",
        "description": "Tinto argentino, ideal para carnes vermelhas.",
        "category_name": "Vinhos Tintos",
        "price": 72.50,
        "promo_active": False,
        "promo_price": None,
        "image_url": SAMPLE_IMAGE_2,
    },
    {
        "name": "Merlot Chileno",
        "description": "Suave, redondo e com final aveludado.",
        "category_name": "Vinhos Tintos",
        "price": 59.00,
        "promo_active": False,
        "promo_price": None,
        "image_url": SAMPLE_IMAGE_1,
    },
    {
        "name": "Chardonnay Sur Lie",
        "description": "Branco amanteigado com toque de baunilha.",
        "category_name": "Vinhos Brancos",
        "price": 68.00,
        "promo_active": True,
        "promo_price": 49.90,
        "image_url": SAMPLE_IMAGE_2,
    },
    {
        "name": "Sauvignon Blanc",
        "description": "Refrescante, cítrico e mineral.",
        "category_name": "Vinhos Brancos",
        "price": 54.00,
        "promo_active": False,
        "promo_price": None,
        "image_url": SAMPLE_IMAGE_1,
    },
    {
        "name": "Prosecco Italiano",
        "description": "Espumante leve e festivo.",
        "category_name": "Espumantes",
        "price": 79.00,
        "promo_active": True,
        "promo_price": 59.00,
        "image_url": SAMPLE_IMAGE_2,
    },
    {
        "name": "Champagne Brut",
        "description": "Champagne francês, perlage fina e elegante.",
        "category_name": "Espumantes",
        "price": 320.00,
        "promo_active": False,
        "promo_price": None,
        "image_url": SAMPLE_IMAGE_1,
    },
    {
        "name": "IPA Artesanal 500ml",
        "description": "Cerveja IPA com lúpulo cítrico marcante.",
        "category_name": "Cervejas Especiais",
        "price": 24.90,
        "promo_active": False,
        "promo_price": None,
        "image_url": SAMPLE_IMAGE_2,
    },
    {
        "name": "Stout Imperial",
        "description": "Cerveja escura, encorpada, com notas de café.",
        "category_name": "Cervejas Especiais",
        "price": 28.90,
        "promo_active": True,
        "promo_price": 22.90,
        "image_url": SAMPLE_IMAGE_1,
    },
    {
        "name": "Whisky 12 anos",
        "description": "Single malt envelhecido em barris de carvalho.",
        "category_name": "Destilados",
        "price": 289.00,
        "promo_active": False,
        "promo_price": None,
        "image_url": SAMPLE_IMAGE_2,
    },
    {
        "name": "Gin London Dry",
        "description": "Gin clássico com botânicos selecionados.",
        "category_name": "Destilados",
        "price": 159.00,
        "promo_active": True,
        "promo_price": 119.00,
        "image_url": SAMPLE_IMAGE_1,
    },
]
