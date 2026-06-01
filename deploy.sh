#!/bin/bash
# ╔══════════════════════════════════════════════════╗
# ║   SCRIPT DE DESPLIEGUE — AUTH2FA EN EC2 Ubuntu  ║
# ╚══════════════════════════════════════════════════╝
#
# USO:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# ANTES DE EJECUTAR edita estas tres variables:

PEM_FILE="C:\Users\chomi\OneDrive\Documentos\proyecto010626flames\autikey.pem"   # Ej: ~/Downloads/autikey.pem
EC2_IP="13.59.44.252"         # Ej: 52.14.143.227
EC2_USER="ubuntu"                  # ubuntu (Ubuntu) | ec2-user (Amazon Linux)

# ──────────────────────────────────────────────────

set -e  # Detener si hay cualquier error

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  🚀 Desplegando Auth2FA en EC2...        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Verificar que el .pem existe
if [ ! -f "$PEM_FILE" ]; then
  echo "❌ No se encontró el archivo .pem en: $PEM_FILE"
  exit 1
fi

# Asegurar permisos correctos del .pem
chmod 400 "$PEM_FILE"

echo "📦 Subiendo proyecto a EC2..."
scp -i "$PEM_FILE" -o StrictHostKeyChecking=no \
  -r "$(dirname "$0")/." \
  "$EC2_USER@$EC2_IP:/home/$EC2_USER/auth-app/"

echo ""
echo "⚙️  Configurando servidor..."
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << 'ENDSSH'

set -e

# ── Instalar Node.js 18 (Ubuntu) ──────────────────
if ! command -v node &> /dev/null; then
  echo "📥 Instalando Node.js 18..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "   Node.js: $(node -v)"
echo "   npm:     $(npm -v)"

# ── Instalar dependencias ─────────────────────────
cd /home/ubuntu/auth-app
npm install --omit=dev

# ── Crear .env si no existe ───────────────────────
if [ ! -f .env ]; then
  echo "📝 Creando .env con secreto aleatorio..."
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo "SESSION_SECRET=$SECRET" > .env
  echo "PORT=3000" >> .env
  echo "NODE_ENV=production" >> .env
fi

# ── Instalar y configurar PM2 ─────────────────────
sudo npm install -g pm2 2>/dev/null || true
pm2 stop auth-app 2>/dev/null || true
pm2 start server.js --name auth-app
pm2 save
# Hacer que PM2 arranque al reiniciar la instancia
pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null || true

echo ""
echo "✅ ¡Despliegue exitoso!"
echo ""
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com)
echo "   🌐 Tu app está en: http://$PUBLIC_IP:3000"
echo ""
echo "   (Recuerda abrir el puerto 3000 en el Security Group de EC2)"
ENDSSH

echo ""
echo "✅ Todo listo. Revisa la URL que aparece arriba."
echo ""
echo "📋 Recuerda en AWS Console → EC2 → Security Groups → Inbound Rules:"
echo "   Tipo: Custom TCP | Puerto: 3000 | Origen: 0.0.0.0/0"
