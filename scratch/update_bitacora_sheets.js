const fs = require('fs');
const path = require('path');

const bitacoraPath = path.join(__dirname, '..', 'bitacora.md');
let content = fs.readFileSync(bitacoraPath, 'utf8');

const newEntry = `
- **[2026-09-23]**: Integración de Control Financiero en Google Sheets y Ajuste de Unidad a $500.00 MXN.
  - **Ajuste de Unidad (Stake)**: Se actualizó el valor de apuesta fija por jugada de $250.00 MXN a **$500.00 MXN** tanto en la base de datos SQLite (\`config_settings\`) como en \`financialTracker.js\`.
  - **Servicio de Google Sheets (\`googleSheetsService.js\`)**:
    - Se creó un módulo desacoplado y tolerante a fallos para enviar picks en tiempo real (\`sendPickToSheet\`) y actualizar veredictos nocturnos o post-partido (\`updateResultInSheet\`).
    - Comunicación mediante Webhook HTTPS de Google Apps Script (\`GOOGLE_SHEETS_WEBHOOK_URL\` en \`.env\`).
  - **Código Google Apps Script (\`google_apps_script.js\`)**:
    - Se generó el script para la hoja de Google Sheets que maneja \`add_pick\`, \`update_result\` y \`batch_sync\`.
    - Formato visual automático: encabezados estilizados, moneda en \`$#,##0.00 MXN\`, colores semafóricos condicionales (amarillo para \`PENDIENTE\`, verde para \`GREEN\`, rojo para \`RED\`).
  - **Conexión en Ciclo de Vida (\`financialTracker.js\`)**:
    - \`addPlay\`: Dispara el registro automático de la fila en Google Sheets en estado PENDIENTE con stake de $500.00 MXN.
    - \`updatePlayVerdict\` y \`resolvePendingPlays\`: Actualizan el marcador, veredicto final y profit calculado.
  - **Control de Versión**: Se incrementó la versión a \`2.19.0\` en \`package.json\`.
`;

fs.writeFileSync(bitacoraPath, content.trim() + '\n' + newEntry, 'utf8');
console.log('Bitácora actualizada correctamente con v2.19.0.');
