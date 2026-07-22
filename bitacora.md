# Bitácora de Desarrollo: Sistema de Alertas de Apuestas

## Objetivo del Proyecto
Crear un sistema automatizado que envíe alertas basadas en eventos de fútbol en vivo (tarjetas rojas, empates al medio tiempo de favoritos, ventajas de underdogs, córneres y partidos calientes) con seguimiento automatizado GREEN/RED post-partido.

## Estado Actual
- FASE 3: Reglas Avanzadas y Auditoría GREEN/RED
- Sistema de 7 reglas estratégicas completado con discriminación de Ligas Top (para optimizar uso de API) y sistema automático de veredicto GREEN 🟩 / RED 🟥 al silbatazo final.

## Decisiones Tomadas
- **Fuente de datos:** API-Football (v3.football.api-sports.io).
- **Plataforma:** Bot de Telegram en Node.js.
- **Reglas 1-4 (Ligas Generales):** Tarjeta Roja Temprana, Favorito Sufre en HT 0-0, Sorpresa Tempranera y Asedio Late Goal.
- **Reglas 5-7 (Exclusivas Ligas Top):** HT Comeback Favorito, Presión de Córneres en Tramo Final, Partido Caliente (Tarjetas).
- **Control de API:** Módulos de consulta condicional (`needsStats` / `needsEvents`) y lista blanca de ligas principales (`config.js`).
- **Seguimiento Post-Partido:** El bot rastrea cada alerta emitida y envía automáticamente un mensaje de veredicto GREEN 🟩 / RED 🟥 cuando el encuentro pasa a estado `FT`.

## Historial de Cambios
- **[2026-07-21]**: Creación de la bitácora y análisis inicial de requerimientos.
- **[2026-07-21]**: Implementación del código base en Node.js (`apiClient.js`, `rulesEngine.js`, `index.js`). Pruebas de simulación exitosas.
- **[2026-07-21]**: Creación de `config.js` para filtrado por ligas principales. Implementación de Reglas 5, 6 y 7, junto con la función `evaluateAlertResults` para calificar alertas emitidas (GREEN/RED). Pruebas de simulación en `test.js` 100% exitosas.
