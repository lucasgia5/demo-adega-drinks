"""White-label brand configuration.

For a new store, this is the main file to edit for brand identity:
name, logo, colors, banner, WhatsApp, Pix, address, public domain,
age gate and business hours.

Example for a custom store:
- name: "Adega Drinks"
- tagline: "os melhor copão de cidade"
- primary_color / secondary_color: brand palette
- banner_url: hero image aligned with the store identity
"""

STORE_CONFIG = {
    "name": "Adega Drinks",
    "tagline": "os melhor copão de cidade",
    "search_placeholder": "Buscar produtos...",
    "logo_url": "",  # leave empty to render text logo
    "store_logo_url": "",
    "primary_color": "#3B2416",  # Dark brown
    "secondary_color": "#D49A2A",  # Amber gold
    "whatsapp_number": "5511999990000",  # international format, digits only
    "address": "Rua das Vinhas, 123 - Centro, São Paulo - SP",
    "pix_key": "contato@adegadovinho.com.br",
    "pix_key_type": "E-mail",
    "banner_url": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=2000&q=85",
    "store_banner_url": "",
    "banner_title": "Adega Drinks",
    "banner_subtitle": "os melhor copão de cidade",
    "banner_button_text": "",
    "banner_button_link": "",
    "banner_enabled": True,
    "public_domain": "https://example.com",
    "currency_symbol": "R$",
    "currency_code": "BRL",
    "delivery_note": "Trabalhamos com entregas e retiradas",
    "checkout_note": "Seu pedido será aberto no WhatsApp da loja já preenchido.",
    "age_gate_enabled": True,
    "age_gate_min_age": 18,
    "age_gate_title": "Você tem 18 anos ou mais?",
    "age_gate_message": (
        "Para acessar esta loja, confirme que você tem idade legal "
        "para consumir bebidas alcoólicas."
    ),
    "business_hours_enabled": True,
    "business_hours_timezone": "America/Sao_Paulo",
    "business_hours": {
        "monday": {"open": "10:00", "close": "22:00", "closed": False},
        "tuesday": {"open": "10:00", "close": "22:00", "closed": False},
        "wednesday": {"open": "10:00", "close": "22:00", "closed": False},
        "thursday": {"open": "10:00", "close": "22:00", "closed": False},
        "friday": {"open": "10:00", "close": "23:00", "closed": False},
        "saturday": {"open": "10:00", "close": "23:00", "closed": False},
        "sunday": {"open": "10:00", "close": "18:00", "closed": False},
    },
    "free_shipping_enabled": True,
    "free_shipping_minimum": 150.00,
}
