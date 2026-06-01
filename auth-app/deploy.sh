#!/bin/bash
# ╔══════════════════════════════════════════════╗
# ║   SCRIPT DE DESPLIEGUE — AUTH2FA EN EC2     ║
# ╚══════════════════════════════════════════════╝
#
# USO:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# ANTES DE EJECUTAR edita estas variables:

PEM_FILE="/c/Users/chomi/OneDrive/Documentos/proyecto010626flames/autikey.pem" # Ruta a tu archivo .pem
EC2_IP="52.14.143.227"                   # IP pública de tu instancia EC2
EC2_USER="ubuntu"          # Usuario: ec2-user (Amazon Linux) | ubuntu (Ubuntu)

# ──────────────────────────────────────────────

echo "📦 Subiendo proyecto a EC2..."
scp -i "$PEM_FILE" -r ./auth-app "$EC2_USER@$EC2_IP:/home/$EC2_USER/"

echo "🚀 Instalando dependencias y levantando servidor..."
ssh -i "$PEM_FILE" "$EC2_USER@$EC2_IP" << 'ENDSSH'

# Instalar Node.js si no está instalado
if ! command -v node &> /dev/null; then
  echo "Instalando Node.js..."
  curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -   # Amazon Linux
  # Para Ubuntu usa: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo yum install -y nodejs   # Amazon Linux
  # Para Ubuntu usa: sudo apt-get install -y nodejs
fi

cd /home/ec2-user/auth-app
npm install

# Instalar pm2 para mantener el servidor activo
sudo npm install -g pm2
pm2 stop auth-app 2>/dev/null || true
pm2 start server.js --name auth-app
pm2 save

echo ""
echo "✅ ¡Listo! App corriendo en:"
echo "   http://$(curl -s http://checkip.amazonaws.com):3000"
ENDSSH
