# Bitácora de Desarrollo: Sistema de Alertas de Apuestas Multideporte

## Objetivo del Proyecto
Crear un sistema automatizado multideporte (Fútbol + MLB Béisbol) que envíe alertas basadas en eventos en vivo (tarjetas rojas, empates al medio tiempo de favoritos, ventajas de underdogs, córneres, partidos calientes y entradas clave de béisbol) con seguimiento automatizado GREEN/RED post-partido.

## Estado Actual
- FASE 4: Módulo Multideporte MLB Béisbol Integrado
- Sistema de 7 reglas de fútbol + 3 reglas de MLB Béisbol completado y verificado. Servidor listo con redeploy automático a Railway.

## Decisiones Tomadas
- **Fuentes de datos:** 
  - Fútbol: `v3.football.api-sports.io`
  - Béisbol (MLB): `v1.baseball.api-sports.io` (misma API Key).
- **Plataforma:** Bot de Telegram en Node.js.
- **Reglas Fútbol (1-7):** Tarjeta Roja, Favorito Sufre HT, Sorpresa Tempranera, Asedio Late Goal, HT Comeback (Top), Late Corners (Top), Partido Caliente (Top).
- **Reglas Béisbol MLB (1-3):** 
  - Regla MLB 1: Favorito en Apuros al Medio Juego (Inning 3-5).
  - Regla MLB 2: Cierre Apretado / Tension (Inning 7-9).
  - Regla MLB 3: Festín de Carreras (Early Over Inning 1-3).
- **Seguimiento Post-Partido:** El bot rastrea cada alerta emitida de fútbol y béisbol y envía automáticamente un mensaje de veredicto GREEN 🟩 / RED 🟥 al silbatazo final o cierre del inning 9.

## Historial de Cambios
- **[2026-07-21]**: Creación de la bitácora y análisis inicial de requerimientos.
- **[2026-07-21]**: Implementación del código base en Node.js (`apiClient.js`, `rulesEngine.js`, `index.js`). Pruebas de simulación exitosas.
- **[2026-07-21]**: Creación de `config.js` para filtrado por ligas principales. Implementación de Reglas 5, 6 y 7, junto con `evaluateAlertResults` (GREEN/RED).
- **[2026-07-22]**: Creación de los módulos de MLB Béisbol (`baseballApiClient.js`, `baseballRulesEngine.js`, `testBaseball.js`). Integración multideporte en `index.js` y desplegado en Railway.
