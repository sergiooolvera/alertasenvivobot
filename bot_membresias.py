import os
import sys
import asyncio
import html
import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

from telethon import TelegramClient, events, Button
from telethon.tl.functions.messages import ExportChatInviteRequest
from telethon.sessions import MemorySession

from gestor_membresias import (
    init_membresias_db,
    obtener_usuario,
    registrar_nuevo_trial,
    activar_premium,
    obtener_usuarios_alerta_dia3,
    marcar_alerta_dia3_enviada,
    obtener_usuarios_para_kick_trial,
    marcar_trial_expirado,
    obtener_usuarios_alerta_dia29,
    marcar_alerta_dia29_enviada,
    obtener_usuarios_para_kick_premium,
    marcar_premium_expirado,
    obtener_estadisticas_membresias
)

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

load_dotenv()

API_ID = int(os.getenv("TELEGRAM_API_ID", "34622692"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "ff8a8c91808884edbf1cce845bede897")
BOT_TOKEN = os.getenv("TELEGRAM_INVITE_BOT_TOKEN", "9089639280:AAEGDSHHR0N0Z5luaCqcoY9BjO8W6lT2FHE")
ADMIN_USER_ID = int(os.getenv("ADMIN_USER_ID", "890184744"))

CANAL_FREE_ID = int(os.getenv("CANAL_FREE_ID", "-1004366484952"))
CANAL_VIP_ID = int(os.getenv("CANAL_VIP_ID", "-1003748312099"))

ZONA_HORARIA = ZoneInfo("America/Mexico_City")

def obtener_datos_pago_html():
    """Genera dinámicamente las instrucciones bancarias desde variables de entorno con formato táctil."""
    precio = os.getenv("PRECIO_MEMBRESIA_MXN", "100")
    banco = os.getenv("BANCO_DESTINO", "BBVA")
    clabe_cruda = os.getenv("CLABE_INTERBANCARIA", "012180004701190246").replace(" ", "")
    titular = os.getenv("TITULAR_CUENTA", "Sergio Olvera")
    concepto = os.getenv("CONCEPTO_PAGO", "asesoria")

    return (
        f"💳 <b>Datos de Transferencia (SPEI):</b>\n"
        f"🏦 <b>Banco:</b> {html.escape(banco)}\n"
        f"🔢 <b>CLABE:</b> <code>{html.escape(clabe_cruda)}</code> <i>(Toca para copiar)</i>\n"
        f"👤 <b>Titular:</b> {html.escape(titular)}\n"
        f"🏷 <b>Concepto:</b> <code>{html.escape(concepto)}</code> <i>(Toca para copiar)</i>\n"
        f"💵 <b>Inversión VIP:</b> ${html.escape(precio)} MXN / mes (30 días)\n\n"
        f"📌 <i>Envía la captura de tu comprobante a este chat para activar tu VIP en el corte más próximo.</i>"
    )

def expulsar_de_canal(bot_token, canal_id, user_id):
    """Expulsa a un usuario de un canal revocando su membresía mediante Bot API."""
    try:
        url_ban = f"https://api.telegram.org/bot{bot_token}/banChatMember"
        r1 = requests.post(url_ban, json={"chat_id": canal_id, "user_id": user_id}, timeout=10)
        url_unban = f"https://api.telegram.org/bot{bot_token}/unbanChatMember"
        requests.post(url_unban, json={"chat_id": canal_id, "user_id": user_id, "only_if_banned": True}, timeout=10)
        return r1.ok
    except Exception as e:
        print(f"⚠️ Error expulsando usuario {user_id} de {canal_id}: {e}")
        return False

async def crear_enlace_un_solo_uso(client, canal_id, titulo="Acceso Personal"):
    """Crea un enlace de invitación de exactamente 1 solo uso para un canal privado."""
    try:
        res = await client(ExportChatInviteRequest(
            peer=canal_id,
            usage_limit=1,
            title=titulo
        ))
        return res.link
    except Exception as e:
        print(f"⚠️ Error creando enlace de 1 uso en {canal_id}: {e}")
        return None

def registrar_manejadores_bot(client):
    """Configura los eventos, comandos y validaciones del bot de membresías de Rojas y Goles."""
    marca_nombre = "Rojas y Goles"

    @client.on(events.NewMessage(pattern=r'^/start', incoming=True, func=lambda e: e.is_private))
    async def handler_start(event):
        sender = await event.get_sender()
        user_id = sender.id
        first_name = sender.first_name or "Apostador"
        username = sender.username or ""

        u = obtener_usuario(user_id)

        if not u:
            # Usuario totalmente nuevo -> Registrar prueba de 4 días
            invite_link = await crear_enlace_un_solo_uso(client, CANAL_FREE_ID, f"Trial 4d - {first_name}")
            if not invite_link:
                await event.reply("⚠️ Hubo un detalle técnico generando tu enlace de invitación. Por favor intenta de nuevo en unos momentos con /start.")
                return

            fin_trial = registrar_nuevo_trial(user_id, username, first_name, CANAL_FREE_ID, invite_link, dias_trial=4)
            fecha_str = fin_trial.strftime("%d/%m/%Y a las %I:%M %p")

            bienvenida = (
                f"⚽ <b>¡Bienvenido a {marca_nombre}, {html.escape(first_name)}!</b>\n\n"
                f"Has activado tu <b>Prueba Gratuita de 4 días</b> para recibir en vivo el 100% de nuestras alertas de goles y tarjetas rojas.\n\n"
                f"⏳ <b>Vigencia de tu prueba:</b> Activa hasta el <b>{fecha_str}</b>.\n\n"
                f"🔗 <b>Tu enlace exclusivo para unirte al Canal Free:</b>\n"
                f"👉 <a href='{invite_link}'>Entrar a Rojas y Goles Free</a>\n"
                f"<i>(Este enlace es personal y expira tras usarse)</i>\n\n"
                f"━━━━━━━━━━━━━━━━━━━\n"
                f"💎 <b>Pase al Canal VIP:</b>\n"
                f"Al concluir tus 4 días, podrás unirte a nuestro <b>Canal VIP por $100 MXN / mes (30 días)</b>.\n\n"
                f"{obtener_datos_pago_html()}\n\n"
                f"💡 <i>Tip: Puedes usar el comando /pagar en cualquier momento para ver los datos bancarios.</i>"
            )
            await event.reply(bienvenida, parse_mode='html', link_preview=False)
            print(f"👤 Nuevo usuario registrado: {first_name} (@{username}) ID: {user_id}")
            return

        # Usuario existente
        estado = u["estado"]

        if estado == "trial":
            try:
                fin_dt = datetime.fromisoformat(u["fecha_fin_trial"])
                fecha_str = fin_dt.strftime("%d/%m/%Y a las %I:%M %p")
            except Exception:
                fecha_str = str(u["fecha_fin_trial"])

            link_texto = f"\n👉 <a href='{u['ultimo_invite_link']}'>Acceder a Rojas y Goles Free</a>\n" if u.get("ultimo_invite_link") else ""

            msg = (
                f"⚽ <b>Hola de nuevo, {html.escape(first_name)}!</b>\n\n"
                f"Tu <b>Prueba Gratuita de 4 días</b> sigue activa hasta el:\n"
                f"📅 <b>{fecha_str}</b>\n"
                f"{link_texto}\n"
                f"💎 <b>¿Quieres asegurar tu pase al Canal VIP ($100 MXN / 30 días)?</b>\n\n"
                f"{obtener_datos_pago_html()}"
            )
            await event.reply(msg, parse_mode='html', link_preview=False)

        elif estado == "expired_trial":
            msg = (
                f"👋 <b>Hola {html.escape(first_name)},</b>\n\n"
                f"Tu periodo de prueba gratuita de 4 días ha finalizado.\n\n"
                f"🚀 <b>Para unirte al Canal VIP y seguir recibiendo todas las alertas en vivo por 30 días:</b>\n\n"
                f"{obtener_datos_pago_html()}"
            )
            await event.reply(msg, parse_mode='html', link_preview=False)

        elif estado == "premium":
            try:
                fin_dt = datetime.fromisoformat(u["fecha_fin_premium"])
                fecha_str = fin_dt.strftime("%d/%m/%Y a las %I:%M %p")
            except Exception:
                fecha_str = str(u["fecha_fin_premium"])

            link_texto = f"\n👉 <a href='{u['ultimo_invite_link']}'>Entrar a Rojas y Goles VIP</a>\n" if u.get("ultimo_invite_link") else ""

            msg = (
                f"👑 <b>¡Hola Miembro VIP, {html.escape(first_name)}!</b>\n\n"
                f"Tu membresía Premium en <b>{marca_nombre} VIP</b> está <b>ACTIVA</b>.\n"
                f"📅 <b>Vigencia hasta:</b> {fecha_str}\n"
                f"{link_texto}\n"
                f"¡Mucho éxito con todas las alertas y parlays en vivo!"
            )
            await event.reply(msg, parse_mode='html', link_preview=False)

        elif estado == "expired_premium":
            msg = (
                f"⚠️ <b>Hola {html.escape(first_name)},</b>\n\n"
                f"Tu membresía VIP en <b>{marca_nombre}</b> ha vencido.\n\n"
                f"🔄 <b>Para renovar 30 días más ($100 MXN) y reingresar al Canal VIP:</b>\n\n"
                f"{obtener_datos_pago_html()}"
            )
            await event.reply(msg, parse_mode='html', link_preview=False)

    @client.on(events.NewMessage(pattern=r'^/(pagar|vip|precio|planes|cuenta)', incoming=True, func=lambda e: e.is_private))
    async def handler_pagar(event):
        sender = await event.get_sender()
        first_name = sender.first_name or "Apostador"
        resp = (
            f"💎 <b>Membresía VIP - {marca_nombre}</b>\n\n"
            f"• Acceso a todas las alertas en vivo (Tarjetas Rojas, Goles HT 0-0, Parlays)\n"
            f"• Duración: <b>30 Días</b>\n\n"
            f"{obtener_datos_pago_html()}"
        )
        await event.reply(resp, parse_mode='html', link_preview=False)

    @client.on(events.NewMessage(pattern=r'^/stats', incoming=True, func=lambda e: e.is_private))
    async def handler_stats(event):
        sender = await event.get_sender()
        if sender.id != ADMIN_USER_ID:
            return
        stats = obtener_estadisticas_membresias()
        msg = (
            f"📊 <b>Estadísticas de Membresías - {marca_nombre}</b>\n\n"
            f"👥 Total Usuarios: <b>{stats['total']}</b>\n"
            f"⏳ En Prueba Activa (4d): <b>{stats['trial']}</b>\n"
            f"🚪 Prueba Vencida: <b>{stats['expired_trial']}</b>\n"
            f"👑 VIP Activos: <b>{stats['premium']}</b>\n"
            f"❌ VIP Vencidos: <b>{stats['expired_premium']}</b>\n"
        )
        await event.reply(msg, parse_mode='html')

    # Manejador de comprobantes (fotos y documentos de pago)
    @client.on(events.NewMessage(incoming=True, func=lambda e: e.is_private and (e.photo or e.document)))
    async def handler_comprobante(event):
        sender = await event.get_sender()
        user_id = sender.id
        first_name = sender.first_name or "Apostador"
        username = f"@{sender.username}" if sender.username else "(Sin username)"

        # Respuesta de confirmación con horarios de corte oficiales
        resp_cliente = (
            f"✅ <b>¡Comprobante recibido con éxito, {html.escape(first_name)}!</b>\n\n"
            f"Tu depósito ha sido turnado a validación bancaria.\n\n"
            f"⏰ <b>Horarios Oficiales de Activación VIP:</b>\n"
            f"• <b>Corte Vespertino:</b> 02:00 PM\n"
            f"• <b>Corte Nocturno:</b> 08:00 PM\n\n"
            f"<i>(Si tu comprobante llegó fuera de estos horarios, tu acceso se activará en el corte más próximo).</i>\n\n"
            f"En cuanto se verifique tu transferencia, recibirás aquí mismo tu enlace exclusivo para ingresar al <b>Canal VIP</b>."
        )
        await event.reply(resp_cliente, parse_mode='html')

        # Reenviar al administrador con botones inline
        u = obtener_usuario(user_id)
        estado_previo = u["estado"] if u else "nuevo"

        caption_admin = (
            f"🔔 <b>NUEVO COMPROBANTE DE PAGO</b>\n"
            f"🏷 <b>Canal:</b> {marca_nombre}\n"
            f"👤 <b>Cliente:</b> {html.escape(first_name)} ({html.escape(username)})\n"
            f"🆔 <b>ID:</b> <code>{user_id}</code>\n"
            f"📋 <b>Estado actual:</b> {estado_previo}\n\n"
            f"¿Aprobar 30 días VIP ($100 MXN)?"
        )

        botones = [
            [
                Button.inline("✅ Aprobar 30 Días", data=f"app_{user_id}"),
                Button.inline("❌ Rechazar", data=f"rec_{user_id}")
            ]
        ]

        await client.send_file(ADMIN_USER_ID, event.message.media, caption=caption_admin, parse_mode='html', buttons=botones)
        print(f"📩 Comprobante de {first_name} ({user_id}) turnado al Administrador.")

    # Manejador de botones inline (Aprobación / Rechazo por el Admin)
    @client.on(events.CallbackQuery)
    async def handler_callback(event):
        data = event.data.decode('utf-8')
        sender = await event.get_sender()

        if sender.id != ADMIN_USER_ID:
            await event.answer("⛔ Acción restringida al Administrador.", alert=True)
            return

        if data.startswith("app_"):
            target_id = int(data.split("_")[1])
            await event.answer("⏳ Aprobando y generando enlace VIP...")

            invite_link = await crear_enlace_un_solo_uso(client, CANAL_VIP_ID, f"VIP 30d - User {target_id}")
            if not invite_link:
                await event.respond(f"❌ Error al generar enlace de 1 solo uso para el canal VIP ({CANAL_VIP_ID}). Verifica permisos del bot.")
                return

            fin_dt = activar_premium(target_id, CANAL_VIP_ID, invite_link, dias=30)
            fecha_str = fin_dt.strftime("%d/%m/%Y a las %I:%M %p")

            # Notificar al cliente
            msg_cliente = (
                f"🎉 <b>¡Tu pago ha sido validado exitosamente!</b>\n\n"
                f"Bienvenido a <b>{marca_nombre} VIP</b> 👑\n\n"
                f"📅 <b>Vigencia activa:</b> 30 días (hasta el <b>{fecha_str}</b>)\n\n"
                f"🔗 <b>Tu enlace exclusivo para unirte al Canal VIP:</b>\n"
                f"👉 <a href='{invite_link}'>Entrar a Rojas y Goles VIP</a>\n\n"
                f"<i>(Este enlace es de uso único personal y expira tras unirte)</i>"
            )
            try:
                await client.send_message(target_id, msg_cliente, parse_mode='html', link_preview=False)
                await event.edit(f"{event.message.text or ''}\n\n✅ <b>APROBADO por {sender.first_name}</b> (VIP activado hasta {fecha_str})", parse_mode='html')
                print(f"👑 VIP Activado con éxito para ID {target_id}")
            except Exception as e:
                await event.respond(f"⚠️ VIP activado en base de datos, pero no se pudo enviar DM al cliente: {e}")

        elif data.startswith("rec_"):
            target_id = int(data.split("_")[1])
            await event.answer("Comprobante rechazado.")
            try:
                msg_rechazo = (
                    f"⚠️ <b>Aviso sobre tu comprobante en {marca_nombre}:</b>\n\n"
                    f"No fue posible validar tu transferencia con la información proporcionada (monto incorrecto, imagen ilegible o referencia no encontrada).\n\n"
                    f"Por favor verifica tus datos bancarios y vuelve a enviar una captura clara de tu comprobante oficial SPEI.\n\n"
                    f"{obtener_datos_pago_html()}"
                )
                await client.send_message(target_id, msg_rechazo, parse_mode='html')
            except Exception as e:
                print(f"⚠️ Error enviando DM de rechazo a {target_id}: {e}")

            await event.edit(f"{event.message.text or ''}\n\n❌ <b>RECHAZADO por {sender.first_name}</b>", parse_mode='html')

async def scheduler_ciclo_vida(client):
    """Tarea en segundo plano que vigila vencimientos de 4 días y de 30 días cada minuto."""
    print("⏰ Scheduler de Ciclo de Vida iniciado (Prueba 4d y VIP 30d)...")
    while True:
        try:
            # 1. Alerta Día 3 (A las 72 horas de prueba)
            alertas_dia3 = obtener_usuarios_alerta_dia3()
            for uid, fn, fin_trial in alertas_dia3:
                try:
                    fin_dt = datetime.fromisoformat(fin_trial)
                    fecha_str = fin_dt.strftime("%d/%m/%Y a las %I:%M %p")
                except Exception:
                    fecha_str = str(fin_trial)

                msg = (
                    f"⚠️ <b>¡Atención {html.escape(fn or 'Apostador')}!</b>\n\n"
                    f"Te restan menos de <b>24 horas</b> de tu prueba gratuita en <b>Rojas y Goles Free</b>.\n"
                    f"⏳ Tu acceso expira el <b>{fecha_str}</b>.\n\n"
                    f"Para evitar interrupciones y continuar recibiendo todas las alertas en el <b>Canal VIP</b> ($100 MXN por 30 días):\n\n"
                    f"{obtener_datos_pago_html()}"
                )
                try:
                    await client.send_message(uid, msg, parse_mode='html')
                    marcar_alerta_dia3_enviada(uid)
                    print(f"📢 Alerta de Día 3 enviada a {uid} ({fn})")
                except Exception as e:
                    print(f"⚠️ No se pudo enviar alerta Día 3 a {uid}: {e}")

            # 2. Expulsión Día 4 (A las 96 horas de prueba)
            kicks_trial = obtener_usuarios_para_kick_trial()
            for uid, fn, canal_asignado in kicks_trial:
                target_canal = canal_asignado or CANAL_FREE_ID
                expulsar_de_canal(BOT_TOKEN, target_canal, uid)
                marcar_trial_expirado(uid)
                print(f"🚪 Usuario {uid} ({fn}) expulsado de {target_canal} por fin de prueba de 4 días.")

                msg_despedida = (
                    f"👋 <b>Hola {html.escape(fn or 'Apostador')},</b>\n\n"
                    f"Tu prueba gratuita de <b>4 días</b> en Rojas y Goles ha finalizado.\n\n"
                    f"Esperamos que hayas disfrutado de nuestras alertas en vivo y parlays. "
                    f"Para ingresar al <b>Canal VIP por 30 días ($100 MXN)</b>:\n\n"
                    f"{obtener_datos_pago_html()}"
                )
                try:
                    await client.send_message(uid, msg_despedida, parse_mode='html')
                except Exception as e:
                    print(f"⚠️ No se pudo enviar despedida de prueba a {uid}: {e}")

            # 3. Alerta Día 29 (A las 24 horas antes de vencer VIP)
            alertas_dia29 = obtener_usuarios_alerta_dia29()
            for uid, fn, fin_prem in alertas_dia29:
                try:
                    fin_dt = datetime.fromisoformat(fin_prem)
                    fecha_str = fin_dt.strftime("%d/%m/%Y a las %I:%M %p")
                except Exception:
                    fecha_str = str(fin_prem)

                msg = (
                    f"⚠️ <b>Aviso de Renovación VIP - Rojas y Goles</b>\n\n"
                    f"Hola {html.escape(fn or 'Apostador')}, tu suscripción VIP vencerá en 24 horas (<b>{fecha_str}</b>).\n\n"
                    f"Para mantener tu acceso sin cortes por otros 30 días ($100 MXN):\n\n"
                    f"{obtener_datos_pago_html()}"
                )
                try:
                    await client.send_message(uid, msg, parse_mode='html')
                    marcar_alerta_dia29_enviada(uid)
                    print(f"📢 Alerta de Día 29 enviada a {uid} ({fn})")
                except Exception as e:
                    print(f"⚠️ No se pudo enviar alerta Día 29 a {uid}: {e}")

            # 4. Expulsión Día 30 (Membresía VIP vencida sin renovar)
            kicks_prem = obtener_usuarios_para_kick_premium()
            for uid, fn, canal_asignado in kicks_prem:
                target_canal = canal_asignado or CANAL_VIP_ID
                expulsar_de_canal(BOT_TOKEN, target_canal, uid)
                marcar_premium_expirado(uid)
                print(f"🚪 Usuario {uid} ({fn}) expulsado de {target_canal} por fin de suscripción VIP.")

                msg_fin_vip = (
                    f"⚠️ <b>Tu suscripción VIP en Rojas y Goles ha expirado.</b>\n\n"
                    f"Puedes reactivar tu acceso por 30 días adicionales en cualquier momento enviando tu comprobante de $100 MXN:\n\n"
                    f"{obtener_datos_pago_html()}"
                )
                try:
                    await client.send_message(uid, msg_fin_vip, parse_mode='html')
                except Exception as e:
                    print(f"⚠️ No se pudo enviar aviso de fin VIP a {uid}: {e}")

        except Exception as e:
            print(f"⚠️ Error en bucle del scheduler de membresías: {e}")

        await asyncio.sleep(60)

async def main():
    init_membresias_db()
    print("📦 Base de datos de membresías inicializada (membresias.db).")

    session = MemorySession()
    client = TelegramClient(session, API_ID, API_HASH)
    await client.start(bot_token=BOT_TOKEN)

    me = await client.get_me()
    print(f"🤖 Bot de Invitaciones conectado: @{me.username} ({me.first_name}) - ID: {me.id}")

    registrar_manejadores_bot(client)

    asyncio.create_task(scheduler_ciclo_vida(client))

    print(f"🚀 Sistema de Membresías y Embudo de Ventas (Rojas y Goles) operando 24/7.")
    await client.run_until_disconnected()

if __name__ == "__main__":
    asyncio.run(main())
