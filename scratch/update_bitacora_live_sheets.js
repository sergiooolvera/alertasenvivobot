const fs = require('fs');
const path = require('path');

const bitacoraPath = path.join(__dirname, '..', 'bitacora.md');
let content = fs.readFileSync(bitacoraPath, 'utf8');

const newEntry = `
- **[2026-09-23]**: Vinculación y Verificación en Vivo de Google Sheets.
  - **Configuración de Webhook**: Se configuró la variable \`GOOGLE_SHEETS_WEBHOOK_URL\` en \`.env\` con la URL de producción de Google Apps Script.
  - **Prueba End-to-End**:
    - Se ejecutó \`scratch/test_live_sheets.js\`.
    - Envío de pick en tiempo real con stake de **$500.00 MXN**: **OK** (\`status: 'success'\`).
    - Actualización de resultado post-partido (GREEN, marcador, beneficio neto): **OK** (\`status: 'success'\`).
    - La hoja de cálculo creó automáticamente la pestaña *"Control de Apuestas"* con formato estilizado, colores semafóricos y moneda en pesos mexicanos.
`;

fs.writeFileSync(bitacoraPath, content.trim() + '\n' + newEntry, 'utf8');
console.log('Bitácora actualizada.');
