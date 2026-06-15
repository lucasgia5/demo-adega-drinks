"""
White Label Store Configuration.

These settings define the brand identity of the storefront and are deliberately
kept out of the admin panel. To re-brand the platform for a different store,
simply update the values below.
"""

STORE_CONFIG = {
    "name": "Adega do Vinho",
    "tagline": "Os melhores rótulos entregues na sua porta",
    "logo_url": "",  # leave empty to render text logo
    "primary_color": "#722F37",  # Bordeaux
    "secondary_color": "#C89F53",  # Cork gold
    "whatsapp_number": "5511999990000",  # international format, digits only
    "address": "Rua das Vinhas, 123 - Centro, São Paulo - SP",
    "pix_key": "contato@adegadovinho.com.br",
    "pix_key_type": "E-mail",
    "banner_url": "https://images.unsplash.com/photo-1578911373434-0cb395d2cbfb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHw0fHx3aW5lJTIwY2VsbGFyJTIwc3RvcmUlMjBpbnRlcmlvcnxlbnwwfHx8fDE3ODE1MzM0OTF8MA&ixlib=rb-4.1.0&q=85",
    "currency_symbol": "R$",
    "currency_code": "BRL",
    "delivery_note": "Entrega em até 60min na sua região",
}
