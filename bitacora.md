# Bitácora de Desarrollo: Sistema de Alertas de Apuestas

## Objetivo del Proyecto
Crear un sistema automatizado que envíe alertas basadas en eventos de fútbol en vivo (tarjetas rojas, empates al medio tiempo de favoritos, ventajas de underdogs).

## Estado Actual
- FASE 2: Desarrollo y Pruebas
- Prototipo inicial construido y probado en entorno simulado. Listo para conectarse con API Keys reales.

## Decisiones Tomadas
- **Fuente de datos:** API-Football (estable y rápida).
- **Plataforma:** Bot de Telegram en Node.js.
- **Momios:** Pre-partido.

## Historial de Cambios
- **[2026-07-21]**: Creación de la bitácora y análisis inicial de requerimientos.
- **[2026-07-21]**: Implementación del código base en Node.js (`apiClient.js`, `rulesEngine.js`, `index.js`). Pruebas de simulación exitosas.
