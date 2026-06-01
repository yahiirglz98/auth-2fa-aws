# 🔐 Auth2FA — Práctica AWS EC2

App de autenticación con **usuario/contraseña + TOTP (Google Authenticator)** desplegada en AWS EC2.

---

## 📁 Estructura del proyecto

```
auth-app/
├── server.js          ← Servidor Express + lógica de auth
├── package.json
├── deploy.sh          ← Script de despliegue a EC2
├── views/
│   ├── login.ejs
│   ├── register.ejs
│   ├── setup-2fa.ejs  ← Muestra QR para escanear
│   ├── verify-2fa.ejs ← Ingresa código de 6 dígitos
│   └── dashboard.ejs  ← Página protegida
└── public/css/
    └── style.css
```

---

## 🚀 Pasos para desplegar

### 1. En tu máquina local

```bash
# Entra a la carpeta
cd auth-app

# Edita deploy.sh con tu .pem e IP de EC2
nano deploy.sh

# Da permisos y ejecuta
chmod +x deploy.sh
./deploy.sh
```

### 2. Manualmente (alternativa)

```bash
# Subir archivos
scp -i tu-archivo.pem -r auth-app ec2-user@TU_IP:/home/ec2-user/

# Conectarte
ssh -i tu-archivo.pem ec2-user@TU_IP

# En la instancia
cd auth-app
npm install
node server.js
```

### 3. Abrir puerto 3000 en EC2

En AWS Console → EC2 → Security Groups → Inbound Rules:
- Tipo: Custom TCP
- Puerto: **3000**
- Origen: 0.0.0.0/0

---

## 🔑 Flujo de autenticación

```
/register  →  Crea cuenta + genera secreto TOTP + muestra QR
     ↓
Escanea QR con Google Authenticator o Authy
     ↓
/login     →  Ingresa usuario y contraseña
     ↓
/verify-2fa →  Ingresa código de 6 dígitos de la app
     ↓
/dashboard →  ✅ Acceso concedido
```

---

## 📋 Para el reporte

Anota tu IP pública de EC2 y adjunta en el reporte:
- `http://TU_IP_EC2:3000`

Capturas sugeridas:
1. Pantalla de registro
2. Código QR para escanear
3. Código en Google Authenticator
4. Pantalla de verificación 2FA
5. Dashboard con sesión activa
