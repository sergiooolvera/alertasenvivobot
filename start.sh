#!/bin/bash

echo "=================================================="
echo "🚀 INICIANDO SERVICIOS DE ROJAS Y GOLES EN RAILWAY"
echo "=================================================="

# 1. Iniciar Bot de Membresías (Python Telethon) en segundo plano
echo "🤖 Iniciando Bot de Membresías (@RojasyGolesInvitacionBot)..."
python3 -u bot_membresias.py &
MEMBRESIA_PID=$!

# 2. Iniciar Motor de Alertas en Vivo (Node.js) en segundo plano
echo "⚽ Iniciando Motor de Alertas de Fútbol (@Alertasenvivobot)..."
node index.js &
NODE_PID=$!

cleanup() {
    echo "🛑 Recibida señal de detención. Terminando procesos..."
    kill -TERM $MEMBRESIA_PID 2>/dev/null || true
    kill -TERM $NODE_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT

echo "✅ Ambos servicios corriendo concurrentemente (PIDs: $MEMBRESIA_PID, $NODE_PID)."

# Monitorear activamente ambos procesos
while kill -0 $MEMBRESIA_PID 2>/dev/null && kill -0 $NODE_PID 2>/dev/null; do
    sleep 3
done

echo "⚠️ Uno de los procesos finalizó. Finalizando contenedor..."
cleanup
