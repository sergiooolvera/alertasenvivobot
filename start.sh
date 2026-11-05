#!/bin/sh
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

# Manejador de señales para apagado limpio (SIGTERM / SIGINT)
cleanup() {
    echo "🛑 Recibida señal de detención. Terminando procesos..."
    kill -TERM $MEMBRESIA_PID 2>/dev/null
    kill -TERM $NODE_PID 2>/dev/null
    wait $MEMBRESIA_PID 2>/dev/null
    wait $NODE_PID 2>/dev/null
    echo "👋 Procesos finalizados con éxito."
    exit 0
}

trap cleanup SIGTERM SIGINT

echo "✅ Ambos servicios corriendo concurrentemente (PIDs: $MEMBRESIA_PID, $NODE_PID)."

# Esperar a que alguno termine o reciba señal
wait -n $MEMBRESIA_PID $NODE_PID
STATUS=$?
echo "⚠️ Uno de los procesos finalizó con código $STATUS. Deteniendo contenedor..."
cleanup
