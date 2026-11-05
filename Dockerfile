FROM node:20-bookworm-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV CHROME_BIN=/usr/bin/chromium

# Instalar Python 3, pip, Chromium headless y fuentes tipográficas
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    chromium \
    fonts-liberation \
    fonts-dejavu-core \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt

# Instalar dependencias de Node.js
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el código fuente
COPY . .

# Permisos de ejecución para el script de arranque
RUN chmod +x start.sh

CMD ["./start.sh"]
