"""White-label brand configuration.

For a new store, this is the main file to edit for brand identity:
name, logo, colors, banner, WhatsApp, Pix, address, public domain,
age gate and business hours.

Example for a custom store:
- name: "A\u00e7a\u00ed da Vila"
- tagline: "a\u00e7a\u00ed montado do seu jeito"
- primary_color / secondary_color: brand palette
- banner_url: hero image aligned with the store identity
"""

STORE_CONFIG = {
    "name": "A\u00e7a\u00ed da Vila",
    "tagline": "A\u00e7a\u00ed cremoso montado do seu jeito",
    "search_placeholder": "Buscar copos, frutas e adicionais...",
    "logo_url": "https://placehold.co/640x240/5B1A78/F8D24E/png?text=Acai+da+Vila",
    "store_logo_url": "https://placehold.co/640x240/5B1A78/F8D24E/png?text=Acai+da+Vila",
    "primary_color": "#5B1A78",
    "secondary_color": "#2FBF71",
    "whatsapp_number": "5511984122002",
    "address": "Rua das Vinhas, 123 - Centro, S\u00e3o Paulo - SP",
    "pix_key": "contato@adegadrinks.com.br",
    "pix_key_type": "E-mail",
    "banner_url": "https://placehold.co/1600x900/5B1A78/FFFFFF/png?text=Acai+cremoso+montado+do+seu+jeito",
    "store_banner_url": "https://placehold.co/1600x900/5B1A78/FFFFFF/png?text=Acai+cremoso+montado+do+seu+jeito",
    "banner_title": "A\u00e7a\u00ed da Vila",
    "banner_subtitle": "Escolha o tamanho, combine frutas, acompanhamentos e coberturas.",
    "banner_button_text": "",
    "banner_button_link": "",
    "banner_enabled": True,
    "public_domain": "https://example.com",
    "currency_symbol": "R$",
    "currency_code": "BRL",
    "delivery_note": "Trabalhamos com entregas e retiradas",
    "checkout_note": "Seu pedido ser\u00e1 aberto no WhatsApp da loja j\u00e1 preenchido.",
    "age_gate_enabled": True,
    "age_gate_min_age": 18,
    "age_gate_title": "Voc\u00ea tem 18 anos ou mais?",
    "age_gate_message": (
        "Para acessar esta loja, confirme que voc\u00ea tem idade legal "
        "para consumir bebidas alco\u00f3licas."
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
