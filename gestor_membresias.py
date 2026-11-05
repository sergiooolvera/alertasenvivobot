import sqlite3
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ZONA_HORARIA = ZoneInfo("America/Mexico_City")
DB_PATH = os.path.join(os.path.dirname(__file__), "membresias.db")

def init_membresias_db():
    """Inicializa la base de datos de usuarios, pruebas gratuitas y membresías premium."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE,
            username TEXT,
            first_name TEXT,
            estado TEXT,  -- 'trial', 'expired_trial', 'premium', 'expired_premium'
            fecha_registro DATETIME,
            fecha_fin_trial DATETIME,
            fecha_fin_premium DATETIME,
            notif_dia3_enviada INTEGER DEFAULT 0,
            notif_dia29_enviada INTEGER DEFAULT 0,
            canal_asignado_id INTEGER,
            ultimo_invite_link TEXT
        )
    ''')
    conn.commit()
    conn.close()

def obtener_usuario(telegram_id):
    """Consulta el estado y registro de un usuario por su ID de Telegram."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT id, telegram_id, username, first_name, estado,
               fecha_registro, fecha_fin_trial, fecha_fin_premium,
               notif_dia3_enviada, notif_dia29_enviada, canal_asignado_id, ultimo_invite_link
        FROM usuarios WHERE telegram_id = ?
    ''', (telegram_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0],
        "telegram_id": row[1],
        "username": row[2],
        "first_name": row[3],
        "estado": row[4],
        "fecha_registro": row[5],
        "fecha_fin_trial": row[6],
        "fecha_fin_premium": row[7],
        "notif_dia3_enviada": bool(row[8]),
        "notif_dia29_enviada": bool(row[9]),
        "canal_asignado_id": row[10],
        "ultimo_invite_link": row[11]
    }

def registrar_nuevo_trial(telegram_id, username, first_name, canal_free_id, invite_link, dias_trial=4):
    """Registra a un usuario nuevo iniciando su prueba gratuita de 4 días."""
    ahora = datetime.now(ZONA_HORARIA)
    fin_trial = ahora + timedelta(days=dias_trial)
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        INSERT INTO usuarios (
            telegram_id, username, first_name, estado,
            fecha_registro, fecha_fin_trial, canal_asignado_id, ultimo_invite_link
        ) VALUES (?, ?, ?, 'trial', ?, ?, ?, ?)
    ''', (
        telegram_id, username, first_name,
        ahora.isoformat(), fin_trial.isoformat(),
        canal_free_id, invite_link
    ))
    conn.commit()
    conn.close()
    return fin_trial

def activar_premium(telegram_id, canal_premium_id, invite_link, dias=30):
    """Activa o renueva la suscripción Premium de un usuario por 30 días."""
    ahora = datetime.now(ZONA_HORARIA)
    fin_premium = ahora + timedelta(days=dias)

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        UPDATE usuarios SET
            estado = 'premium',
            fecha_fin_premium = ?,
            canal_asignado_id = ?,
            ultimo_invite_link = ?,
            notif_dia29_enviada = 0
        WHERE telegram_id = ?
    ''', (fin_premium.isoformat(), canal_premium_id, invite_link, telegram_id))
    conn.commit()
    conn.close()
    return fin_premium

def obtener_usuarios_alerta_dia3():
    """Usuarios en prueba gratuita con más de 72 horas (Día 3) que no han recibido recordatorio."""
    ahora = datetime.now(ZONA_HORARIA)
    umbral_dia3 = ahora + timedelta(days=1) # Le queda 1 día o menos de los 4 días
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT telegram_id, first_name, fecha_fin_trial
        FROM usuarios
        WHERE estado = 'trial'
          AND notif_dia3_enviada = 0
          AND fecha_fin_trial <= ?
    ''', (umbral_dia3.isoformat(),))
    rows = c.fetchall()
    conn.close()
    return rows

def marcar_alerta_dia3_enviada(telegram_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('UPDATE usuarios SET notif_dia3_enviada = 1 WHERE telegram_id = ?', (telegram_id,))
    conn.commit()
    conn.close()

def obtener_usuarios_para_kick_trial():
    """Usuarios en prueba gratuita cuya fecha_fin_trial ya venció (Día 4 cumplido)."""
    ahora = datetime.now(ZONA_HORARIA)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT telegram_id, first_name, canal_asignado_id
        FROM usuarios
        WHERE estado = 'trial'
          AND fecha_fin_trial <= ?
    ''', (ahora.isoformat(),))
    rows = c.fetchall()
    conn.close()
    return rows

def marcar_trial_expirado(telegram_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE usuarios SET estado = 'expired_trial' WHERE telegram_id = ?", (telegram_id,))
    conn.commit()
    conn.close()

def obtener_usuarios_alerta_dia29():
    """Usuarios premium cuya membresía vence en 24 horas o menos (Día 29)."""
    ahora = datetime.now(ZONA_HORARIA)
    umbral_dia29 = ahora + timedelta(days=1)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT telegram_id, first_name, fecha_fin_premium
        FROM usuarios
        WHERE estado = 'premium'
          AND notif_dia29_enviada = 0
          AND fecha_fin_premium <= ?
    ''', (umbral_dia29.isoformat(),))
    rows = c.fetchall()
    conn.close()
    return rows

def marcar_alerta_dia29_enviada(telegram_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('UPDATE usuarios SET notif_dia29_enviada = 1 WHERE telegram_id = ?', (telegram_id,))
    conn.commit()
    conn.close()

def obtener_usuarios_para_kick_premium():
    """Usuarios premium cuya fecha_fin_premium ya venció (Día 30 cumplido sin renovar)."""
    ahora = datetime.now(ZONA_HORARIA)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT telegram_id, first_name, canal_asignado_id
        FROM usuarios
        WHERE estado = 'premium'
          AND fecha_fin_premium <= ?
    ''', (ahora.isoformat(),))
    rows = c.fetchall()
    conn.close()
    return rows

def marcar_premium_expirado(telegram_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE usuarios SET estado = 'expired_premium' WHERE telegram_id = ?", (telegram_id,))
    conn.commit()
    conn.close()

def obtener_estadisticas_membresias():
    """Genera métricas comparativas para el panel de administración (/stats)."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT estado, COUNT(*)
        FROM usuarios
        GROUP BY estado
    ''')
    rows = c.fetchall()
    conn.close()
    
    stats = {"total": 0, "trial": 0, "expired_trial": 0, "premium": 0, "expired_premium": 0}
    for est, count in rows:
        if est in stats:
            stats[est] = count
            stats["total"] += count
            
    return stats
