const fs = require('fs');
const path = require('path');

const bitacoraPath = path.join(__dirname, '..', 'bitacora.md');
let content = fs.readFileSync(bitacoraPath, 'utf8');

const newEntry = `
- **[2026-09-23]**: Optimización del Motor de Reglas en \`rulesEngine.js\` - Conservación Exclusiva de Reglas 1, 7, 8 y 9.
  - **Depuración de Reglas con Rendimiento Negativo**:
    - Se eliminó la generación de alertas para la **Regla 4 (Asedio Intenso / Late Goal)**.
    - Se eliminó la generación de alertas para la **Regla 5 (Remontada al Descanso / HT Comeback)**.
    - Se eliminó la generación de alertas para la **Regla 6 (Presión de Córneres / Late Corners)**.
  - **Reglas Mantenidas con Vida (Activas)**:
    - **Regla 1 (Tarjeta Roja Estratégica)**: Activa (min 35 a 76 con posesión >= 40%).
    - **Regla 7 (Partido Caliente / Over Tarjetas)**: Activa (min 25 a 45, >= 4 amarillas o 1 roja).
    - **Regla 8 (Favorito Domina HT)**: Activa (descanso, empate, cuota < 1.40 con dominio de posesión y tiros/córneres).
    - **Regla 9 (Gol Inminente Global)**: Activa (ratio de tiros a puerta combinados > elapsed / 6).
  - **Optimización de Llamadas API (\`needsStats\`)**: Se removió la condición de stats min 75-83 en ligas menores correspondiente a la Regla 4, reduciendo el consumo de cuotas de la API.
  - **Compatibilidad Histórica**: Se preservó la lógica de resolución en \`evaluateAlertResults\` para garantizar el cierre adecuado de alertas previas pendientes.
  - **Validación**: Se actualizó \`test.js\` cubriendo las reglas activas 1, 7, 8, 9 y comprobando formalmente la inactividad de las reglas 4, 5 y 6 con 100% de tests aprobados.
  - **Control de Versión**: Se incrementó la versión a \`2.18.0\` en \`package.json\`.
`;

fs.writeFileSync(bitacoraPath, content.trim() + '\n' + newEntry, 'utf8');
console.log('Bitácora actualizada correctamente con v2.18.0.');
