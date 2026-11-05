import os
import sys
import unittest
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import gestor_membresias
from bot_membresias import obtener_datos_pago_html

ZONA_HORARIA = ZoneInfo("America/Mexico_City")

class TestMembresias(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Usar una base de datos temporal de pruebas
        cls.test_db = os.path.join(os.path.dirname(__file__), "test_membresias.db")
        gestor_membresias.DB_PATH = cls.test_db
        if os.path.exists(cls.test_db):
            os.remove(cls.test_db)
        gestor_membresias.init_membresias_db()

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.test_db):
            os.remove(cls.test_db)

    def test_01_registro_nuevo_trial(self):
        user_id = 111222333
        fin_trial = gestor_membresias.registrar_nuevo_trial(
            telegram_id=user_id,
            username="testuser",
            first_name="Carlos",
            canal_free_id=-1004366484952,
            invite_link="https://t.me/+test_trial",
            dias_trial=4
        )
        u = gestor_membresias.obtener_usuario(user_id)
        self.assertIsNotNone(u)
        self.assertEqual(u["telegram_id"], user_id)
        self.assertEqual(u["first_name"], "Carlos")
        self.assertEqual(u["estado"], "trial")
        self.assertFalse(u["notif_dia3_enviada"])
        self.assertFalse(u["notif_dia29_enviada"])
        self.assertEqual(u["ultimo_invite_link"], "https://t.me/+test_trial")

    def test_02_activar_premium(self):
        user_id = 111222333
        fin_prem = gestor_membresias.activar_premium(
            telegram_id=user_id,
            canal_premium_id=-1003748312099,
            invite_link="https://t.me/+test_vip",
            dias=30
        )
        u = gestor_membresias.obtener_usuario(user_id)
        self.assertEqual(u["estado"], "premium")
        self.assertEqual(u["ultimo_invite_link"], "https://t.me/+test_vip")
        self.assertEqual(u["canal_asignado_id"], -1003748312099)

    def test_03_ciclo_vida_alertas_y_expiraciones(self):
        # Usuario a punto de expirar trial (Día 3)
        uid_dia3 = 444555666
        gestor_membresias.registrar_nuevo_trial(
            telegram_id=uid_dia3,
            username="user_dia3",
            first_name="Diana",
            canal_free_id=-1004366484952,
            invite_link="https://t.me/+test3",
            dias_trial=4
        )
        # Modificar manualmente fecha_fin_trial a dentro de 12 horas (queda < 24h)
        ahora = datetime.now(ZONA_HORARIA)
        casi_fin = ahora + timedelta(hours=12)
        conn = gestor_membresias.sqlite3.connect(self.test_db)
        c = conn.cursor()
        c.execute("UPDATE usuarios SET fecha_fin_trial = ? WHERE telegram_id = ?", (casi_fin.isoformat(), uid_dia3))
        conn.commit()
        conn.close()

        alertas = gestor_membresias.obtener_usuarios_alerta_dia3()
        self.assertTrue(any(row[0] == uid_dia3 for row in alertas))

        # Marcar alerta enviada
        gestor_membresias.marcar_alerta_dia3_enviada(uid_dia3)
        alertas_after = gestor_membresias.obtener_usuarios_alerta_dia3()
        self.assertFalse(any(row[0] == uid_dia3 for row in alertas_after))

        # Modificar a vencido (pasó de 4 días)
        pasado = ahora - timedelta(hours=2)
        conn = gestor_membresias.sqlite3.connect(self.test_db)
        c = conn.cursor()
        c.execute("UPDATE usuarios SET fecha_fin_trial = ? WHERE telegram_id = ?", (pasado.isoformat(), uid_dia3))
        conn.commit()
        conn.close()

        kicks = gestor_membresias.obtener_usuarios_para_kick_trial()
        self.assertTrue(any(row[0] == uid_dia3 for row in kicks))
        gestor_membresias.marcar_trial_expirado(uid_dia3)
        u_kick = gestor_membresias.obtener_usuario(uid_dia3)
        self.assertEqual(u_kick["estado"], "expired_trial")

    def test_04_formato_instrucciones_pago(self):
        html_pago = obtener_datos_pago_html()
        self.assertIn("$100 MXN", html_pago)
        self.assertIn("012180004701190246", html_pago)
        self.assertIn("BBVA", html_pago)
        self.assertIn("Sergio Olvera", html_pago)
        self.assertIn("asesoria", html_pago)

    def test_05_estadisticas(self):
        stats = gestor_membresias.obtener_estadisticas_membresias()
        self.assertEqual(stats["total"], 2)
        self.assertEqual(stats["premium"], 1)
        self.assertEqual(stats["expired_trial"], 1)

if __name__ == '__main__':
    unittest.main()
