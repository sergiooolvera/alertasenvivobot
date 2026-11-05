import os
import sys
import asyncio
from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.tl.functions.channels import CreateChannelRequest, EditAdminRequest
from telethon.tl.types import ChatAdminRights

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if sys.stderr.encoding != 'utf-8':
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Cargar variables de hacktipsters para API_ID y API_HASH
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "hacktipsters", ".env"))
# Cargar también .env local si existe
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=False)

API_ID = int(os.getenv("TELEGRAM_API_ID", "34622692"))
API_HASH = os.getenv("TELEGRAM_API_HASH")

BOT_ALERTAS_USERNAME = "Alertasenvivobot"
BOT_INVITACION_USERNAME = "RojasyGolesInvitacionBot"

CANALES_A_CREAR = [
    {
        "clave": "CANAL_FREE_ID",
        "titulo": "Rojas y Goles Free",
        "descripcion": "Canal Oficial de Alertas en Vivo Rojas y Goles. Prueba gratuita de 4 días."
    },
    {
        "clave": "CANAL_VIP_ID",
        "titulo": "Rojas y Goles VIP",
        "descripcion": "Canal VIP Oficial de Alertas en Vivo Rojas y Goles. Acceso exclusivo para miembros activos."
    }
]

async def main():
    session_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "hacktipsters", "session_userbot"))
    client = TelegramClient(session_path, API_ID, API_HASH)
    await client.start()

    print("🔌 Conectado con la cuenta de Telegram...")
    me = await client.get_me()
    print(f"👤 Cuenta: {me.first_name} (@{me.username}) - ID: {me.id}")

    # Obtener entidades de los dos bots
    bots = {}
    for bot_user in [BOT_ALERTAS_USERNAME, BOT_INVITACION_USERNAME]:
        try:
            entity = await client.get_entity(bot_user)
            bots[bot_user] = entity
            print(f"🤖 Bot detectado: @{bot_user} (ID: {entity.id})")
        except Exception as e:
            print(f"⚠️ Error detectando bot @{bot_user}: {e}")

    admin_rights = ChatAdminRights(
        change_info=True,
        post_messages=True,
        edit_messages=True,
        delete_messages=True,
        ban_users=True,
        invite_users=True
    )

    resultados = {}

    for info in CANALES_A_CREAR:
        print(f"\n🚀 Creando canal privado: '{info['titulo']}'...")
        try:
            created = await client(CreateChannelRequest(
                title=info["titulo"],
                about=info["descripcion"],
                megagroup=False
            ))
            c = created.chats[0]
            cid = int(f"-100{c.id}")
            resultados[info["clave"]] = cid
            print(f"   ✅ Canal creado exitosamente: '{c.title}'")
            print(f"   🆔 ID asignado: {cid}")

            # Promover los dos bots
            for bot_user, bot_entity in bots.items():
                try:
                    await client(EditAdminRequest(
                        channel=c,
                        user_id=bot_entity,
                        admin_rights=admin_rights,
                        rank="Admin Bot"
                    ))
                    print(f"   ✅ @{bot_user} promovido como Administrador en '{c.title}'.")
                except Exception as e:
                    print(f"   ⚠️ Error asignando admin a @{bot_user} en '{c.title}': {e}")

        except Exception as e:
            print(f"   ❌ Error creando canal '{info['titulo']}': {e}")

    print("\n" + "="*50)
    print("📋 RESUMEN DE CANALES CREADOS:")
    for k, v in resultados.items():
        print(f"{k}={v}")
    print("="*50)

    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
