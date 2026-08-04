const fs = require('fs');
const path = require('path');
const financialTracker = require('../financialTracker');

const TRACKER_FILE = path.join(__dirname, '..', 'financial_tracker.json');

console.log("--- Iniciando Pruebas de Reconstrucción de trackedMatches ---\n");

// Respaldar archivo real si existe
let backupContent = null;
if (fs.existsSync(TRACKER_FILE)) {
    backupContent = fs.readFileSync(TRACKER_FILE, 'utf8');
    console.log("💾 Respaldando archivo financial_tracker.json existente...");
}

try {
    // 1. Crear un financial_tracker.json de prueba con jugadas PENDING y una GREEN
    const mockData = {
        startDate: "2026-08-02",
        initialBalance: 5000,
        stakeAmount: 250,
        plays: [
            {
                fixtureId: 99991,
                date: "2026-08-04",
                home: "Real Madrid",
                away: "Barcelona",
                recommendation: "Over 2.5 Goles",
                suggestedOdd: 1.85,
                stake: 250,
                status: "PENDING",
                ruleName: "Sorpresa Tempranera",
                metadata: { ruleName: "Sorpresa Tempranera", ruleType: 3 }
            },
            {
                fixtureId: 99992,
                date: "2026-08-04",
                home: "Arsenal",
                away: "Chelsea",
                recommendation: "Gana Arsenal",
                suggestedOdd: 1.70,
                stake: 250,
                status: "PENDING",
                ruleName: "HT Comeback Favorito",
                metadata: { ruleName: "HT Comeback Favorito", ruleType: 5 }
            },
            {
                fixtureId: 99993,
                date: "2026-08-04",
                home: "Juventus",
                away: "Milan",
                recommendation: "Over 9 Córneres",
                suggestedOdd: 1.90,
                stake: 250,
                status: "GREEN", // Ya resuelto
                ruleName: "Late Corners",
                metadata: { ruleName: "Late Corners", ruleType: 6 }
            }
        ]
    };

    fs.writeFileSync(TRACKER_FILE, JSON.stringify(mockData, null, 2), 'utf8');
    console.log("📝 Creado archivo financial_tracker.json con 2 jugadas PENDING y 1 GREEN.");

    // 2. Probar getPendingPlays
    const pendingPlays = financialTracker.getPendingPlays();
    console.log(`\n🔍 Jugadas pendientes detectadas por getPendingPlays(): ${pendingPlays.length}`);
    if (pendingPlays.length === 2) {
        console.log("✅ getPendingPlays() retornó exactamente las 2 jugadas pendientes.");
    } else {
        throw new Error(`getPendingPlays() debió retornar 2 jugadas, retornó ${pendingPlays.length}`);
    }

    // 3. Simular la reconstrucción de trackedMatches
    const trackedMatches = new Map();
    console.log("\n⚙️ Simulando reconstrucción de trackedMatches...");
    
    for (const play of pendingPlays) {
        const fixtureId = play.fixtureId;
        if (!trackedMatches.has(fixtureId)) {
            trackedMatches.set(fixtureId, {
                home: play.home,
                away: play.away,
                alertsMetadata: []
            });
        }
        const trackedInfo = trackedMatches.get(fixtureId);
        const hasRule = trackedInfo.alertsMetadata.some(m => m.ruleName === play.ruleName);
        if (!hasRule && play.metadata) {
            const meta = { ...play.metadata, isSent: true };
            trackedInfo.alertsMetadata.push(meta);
        }
    }

    console.log(`📊 Partidos en trackedMatches reconstruidos: ${trackedMatches.size}`);
    
    // Validar partido 99991 (Real Madrid vs Barcelona)
    const rm = trackedMatches.get(99991);
    if (rm && rm.home === "Real Madrid" && rm.alertsMetadata.length === 1 && rm.alertsMetadata[0].isSent === true) {
        console.log("✅ Partido 99991 reconstruido correctamente con isSent: true.");
    } else {
        throw new Error("Fallo en la reconstrucción del partido 99991.");
    }

    // Validar partido 99992 (Arsenal vs Chelsea)
    const ars = trackedMatches.get(99992);
    if (ars && ars.away === "Chelsea" && ars.alertsMetadata.length === 1 && ars.alertsMetadata[0].ruleName === "HT Comeback Favorito") {
        console.log("✅ Partido 99992 reconstruido correctamente.");
    } else {
        throw new Error("Fallo en la reconstrucción del partido 99992.");
    }

    console.log("\n🎉 Todas las pruebas locales pasaron exitosamente!");

} catch (err) {
    console.error("\n❌ Error durante las pruebas:", err.message);
} finally {
    // Restaurar el archivo original
    if (backupContent !== null) {
        fs.writeFileSync(TRACKER_FILE, backupContent, 'utf8');
        console.log("\n🔄 Archivo financial_tracker.json original restaurado.");
    } else {
        if (fs.existsSync(TRACKER_FILE)) {
            fs.unlinkSync(TRACKER_FILE);
            console.log("\n🗑️ Archivo financial_tracker.json de prueba eliminado.");
        }
    }
}
