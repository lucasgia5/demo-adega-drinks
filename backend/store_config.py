"""White-label brand configuration.

For a new store, this is the main file to edit for brand identity:
name, logo, colors, banner, WhatsApp, Pix, address and public domain.

Example for a frame store:
- name: "Galeria dos Quadros"
- tagline: "Quadros decorativos para transformar seus ambientes"
- primary_color / secondary_color: brand palette
- banner_url: hero image showing frames/wall art
"""

STORE_CONFIG = {
    "name": "Adega do Vinho",
    "tagline": "Os melhores rótulos entregues na sua porta",
    "search_placeholder": "Buscar produtos...",
    "logo_url": "",  # leave empty to render text logo
    "primary_color": "#722F37",  # Bordeaux
    "secondary_color": "#C89F53",  # Cork gold
    "whatsapp_number": "5511999990000",  # international format, digits only
    "address": "Rua das Vinhas, 123 - Centro, São Paulo - SP",
    "pix_key": "contato@adegadovinho.com.br",
    "pix_key_type": "E-mail",
    "banner_url": "https://images.unsplash.com/photo-1578911373434-0cb395d2cbfb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHw0fHx3aW5lJTIwY2VsbGFyJTIwc3RvcmUlMjBpbnRlcmlvcnxlbnwwfHx8fDE3ODE1MzM0OTF8MA&ixlib=rb-4.1.0&q=85",
    "public_domain": "https://example.com",
    "currency_symbol": "R$",
    "currency_code": "BRL",
    "delivery_note": "Entrega em até 60min na sua região",
    "checkout_note": "Seu pedido será aberto no WhatsApp da loja já preenchido.",
}
