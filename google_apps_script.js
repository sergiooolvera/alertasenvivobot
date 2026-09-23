/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: SISTEMA DE CONTROL DE APUESTAS (ALERTAS EN VIVO)
 * =========================================================================
 * Instrucciones de instalación:
 * 1. Abre una hoja de cálculo en blanco en Google Sheets.
 * 2. En el menú superior, ve a: Extensiones > Apps Script.
 * 3. Borra todo el código que aparezca y pega este archivo completo.
 * 4. Haz clic en "Implementar" (botón azul arriba a la derecha) > "Nueva implementación".
 * 5. Selecciona el tipo: "Aplicación web".
 * 6. Configura:
 *    - Descripción: "Control de Apuestas Webhook"
 *    - Ejecutar como: "Yo" (tu cuenta de Google)
 *    - Quién tiene acceso: "Cualquier usuario" (Anyone)
 * 7. Haz clic en "Implementar" y copia la "URL de la aplicación web".
 * 8. Pega esa URL en el archivo .env de tu bot:
 *    GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/xxxxxx/exec
 * =========================================================================
 */

const SHEET_NAME = 'Control de Apuestas';

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    const action = contents.action;
    const data = contents.data;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = setupInitialSheet(ss);
    }

    if (action === 'add_pick') {
      handleAddPick(sheet, data);
      return responseJSON({ status: 'success', message: 'Pick registrado exitosamente' });
    } else if (action === 'update_result') {
      handleUpdateResult(sheet, data);
      return responseJSON({ status: 'success', message: 'Resultado actualizado exitosamente' });
    } else if (action === 'batch_sync') {
      if (Array.isArray(data.plays)) {
        data.plays.forEach(p => handleAddPick(sheet, p));
      }
      return responseJSON({ status: 'success', message: 'Lote sincronizado exitosamente' });
    }

    return responseJSON({ status: 'error', message: 'Acción no reconocida' });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function doGet() {
  return responseJSON({
    status: 'online',
    message: 'Webhook de Control de Apuestas activo y listo para recibir datos.'
  });
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Configuración inicial de la hoja con encabezados y diseño profesional.
 */
function setupInitialSheet(ss) {
  let sheet = ss.insertSheet(SHEET_NAME);
  
  // Encabezados
  const headers = [
    'ID Fixture',
    'Fecha',
    'Hora',
    'Liga',
    'Partido',
    'Regla',
    'Pronóstico / Selección',
    'Momio',
    'Stake ($)',
    'Estatus',
    'Marcador Final',
    'Beneficio Neto ($ MXN)',
    'Explicación / Veredicto'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Estilo de encabezados
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#0f172a');
  headerRange.setFontColor('#f8fafc');
  headerRange.setFontWeight('bold');
  headerRange.setFontFamily('Inter');
  headerRange.setHorizontalAlignment('center');
  
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 35);
  
  return sheet;
}

/**
 * Inserta un nuevo pick en vivo en la hoja.
 */
function handleAddPick(sheet, data) {
  const lastRow = sheet.getLastRow();
  
  // Evitar duplicados por ID de fixture y regla
  if (lastRow > 1) {
    const fixtureIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    const rules = sheet.getRange(2, 6, lastRow - 1, 1).getValues().flat();
    
    for (let i = 0; i < fixtureIds.length; i++) {
      if (String(fixtureIds[i]) === String(data.fixtureId) && String(rules[i]) === String(data.ruleName)) {
        return; // Ya existe en la hoja
      }
    }
  }

  const newRow = [
    data.fixtureId,
    data.date,
    data.time,
    data.league,
    data.match || `${data.home} vs ${data.away}`,
    data.ruleName,
    data.recommendation,
    parseFloat(data.suggestedOdd) || 1.60,
    parseFloat(data.stake) || 500.00,
    data.status || 'PENDIENTE',
    data.score || '-',
    0.00, // Beneficio inicial
    data.explanation || 'Esperando resultado post-partido'
  ];

  sheet.appendRow(newRow);
  const rowIdx = sheet.getLastRow();

  // Formato de celdas
  sheet.getRange(rowIdx, 8).setNumberFormat('0.00'); // Momio
  sheet.getRange(rowIdx, 9).setNumberFormat('$#,##0.00'); // Stake
  sheet.getRange(rowIdx, 12).setNumberFormat('$#,##0.00'); // Profit
  
  // Estatus inicial (Amarillo PENDIENTE)
  const statusCell = sheet.getRange(rowIdx, 10);
  statusCell.setBackground('#fef3c7');
  statusCell.setFontColor('#92400e');
  statusCell.setFontWeight('bold');
  statusCell.setHorizontalAlignment('center');
}

/**
 * Actualiza el resultado nocturno / post-partido.
 */
function handleUpdateResult(sheet, data) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const fixtureIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const rules = sheet.getRange(2, 6, lastRow - 1, 1).getValues().flat();
  
  let targetRow = -1;
  for (let i = 0; i < fixtureIds.length; i++) {
    if (String(fixtureIds[i]) === String(data.fixtureId)) {
      if (!data.ruleName || String(rules[i]) === String(data.ruleName)) {
        targetRow = i + 2; // Compensar fila 1 de encabezados y base 0
        break;
      }
    }
  }

  if (targetRow === -1) return;

  const status = (data.status || 'PENDIENTE').toUpperCase();
  const profit = parseFloat(data.profit) || 0.00;

  // Actualizar Estatus (columna 10)
  const statusCell = sheet.getRange(targetRow, 10);
  statusCell.setValue(status);
  statusCell.setHorizontalAlignment('center');
  statusCell.setFontWeight('bold');

  if (status === 'GREEN') {
    statusCell.setBackground('#d1fae5');
    statusCell.setFontColor('#065f46');
  } else if (status === 'RED') {
    statusCell.setBackground('#fee2e2');
    statusCell.setFontColor('#991b1b');
  } else {
    statusCell.setBackground('#f3f4f6');
    statusCell.setFontColor('#374151');
  }

  // Actualizar Marcador Final (columna 11)
  if (data.score && data.score !== 'N/D') {
    sheet.getRange(targetRow, 11).setValue(data.score).setHorizontalAlignment('center');
  }

  // Actualizar Beneficio Neto (columna 12)
  const profitCell = sheet.getRange(targetRow, 12);
  profitCell.setValue(profit);
  profitCell.setNumberFormat('$#,##0.00');
  profitCell.setFontWeight('bold');
  if (profit > 0) {
    profitCell.setFontColor('#059669');
  } else if (profit < 0) {
    profitCell.setFontColor('#dc2626');
  } else {
    profitCell.setFontColor('#6b7280');
  }

  // Actualizar Explicación (columna 13)
  if (data.explanation) {
    sheet.getRange(targetRow, 13).setValue(data.explanation);
  }
}
