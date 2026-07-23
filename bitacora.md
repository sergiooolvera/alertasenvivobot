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
- **[2026-07-22]**: Resolución de Error HTTP 429 (Rate Limit de API-Sports). Se implementó un sistema de caché negativo (`NO_ODDS`), filtrado de partidos en vivo para evitar consultas redundantes de partidos finalizados y cooldown automático de 60 segundos ante status 429 en `apiClient.js` y `baseballApiClient.js`. Reducción masiva de peticiones API de ~50+/min a ~2-4/min. Pruebas de integración exitosas.
- **[2026-07-22]**: Integración de Recomendaciones de Apuestas y Cuota Objetivo `@1.60 o más`. Se actualizaron los motores de reglas (`rulesEngine.js` y `baseballRulesEngine.js`) para incluir la recomendación directa del mercado a operar (ej: Doble Chance, Over 0.5 2HT, Córneres Totales, Hándicap) junto con la cuota objetivo sugerida `@1.60 o más`. Pruebas en `test.js` y `testBaseball.js` verificadas.
- **[2026-07-22]**: Restricción de Horario de Monitoreo (7 AM - 9 PM Hora Centro México). Se configuró `America/Mexico_City` y `isWithinActiveHours()` en `config.js` e `index.js` para ejecutar el polling por cron únicamente de 07:00 a 21:00 hrs CST/CDT, previniendo el consumo innecesario de peticiones API durante la noche/madrugada.
- **[2026-07-22]**: Despliegue Exitoso a Producción (`main`). Se enviaron todos los cambios y mejoras (solución Rate Limit 429, cuotas objetivo @1.60 y restricción de horario 7 AM - 9 PM CDMX) al repositorio GitHub, activando el despliegue automático en Railway.
- **[2026-07-22]**: Investigación sobre Alertas de MLB. Se detectó que la API de béisbol (`v1.baseball.api-sports.io`) con el plan gratuito ("Free Plan") bloquea el acceso a la temporada actual devolviendo el error: `Free plans do not have access to this season, try from 2022 to 2024.` Adicionalmente, se identificó que el horario restrictivo de monitoreo (7 AM - 9 PM CDMX) corta el seguimiento de partidos nocturnos de la MLB que finalizan más tarde.
- **[2026-07-23]**: Integración de Inteligencia Artificial (Gemini) para análisis y recomendaciones dinámicas. Se creó el módulo `aiService.js` para consumir la API de REST de Gemini con Axios de forma nativa. Se implementó un sistema de rotación de múltiples claves y fallback de modelo (`gemini-flash-latest` -> `gemini-2.5-flash`). Se diseñaron prompts irreverentes e informales en español para fútbol y MLB. Para resolver el truncado por consumo de tokens del razonamiento interno (Thinking), se elevó el límite a `maxOutputTokens: 4000` y el timeout a 20 segundos. Se integró la llamada en `index.js` para fútbol y béisbol reemplazando dinámicamente las recomendaciones fijas con fallbacks tolerantes a errores.





