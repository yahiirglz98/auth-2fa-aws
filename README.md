# 🔐 Auth2FA — Práctica AWS EC2

App de autenticación con **usuario/contraseña + TOTP (MFA)** desplegada en AWS EC2.

Incluye: bcrypt · speakeasy · códigos de respaldo · sesiones seguras

---

## 📁 Estructura

```
auth-app/
├── server.js            ← Servidor Express + lógica de auth
├── package.json
├── .env.example         ← Copia a .env y configura
├── deploy.sh            ← Script de despliegue a EC2 Ubuntu
├── views/
│   ├── login.ejs
│   ├── register.ejs
│   ├── setup-2fa.ejs    ← Muestra QR + códigos de respaldo
│   ├── verify-2fa.ejs   ← Ingresa código TOTP o respaldo
│   └── dashboard.ejs    ← Página protegida
└── public/css/
    └── style.css
```

---

## 🚀 Despliegue en EC2

### 1. Preparar localmente

```bash
# Edita deploy.sh con tu .pem e IP
nano deploy.sh

# Ejecutar
chmod +x deploy.sh
./deploy.sh
```

### 2. Manualmente (alternativa)

```bash
# Subir archivos
scp -i tu-archivo.pem -r auth-app ubuntu@TU_IP:/home/ubuntu/

# Conectar
ssh -i tu-archivo.pem ubuntu@TU_IP

# En la instancia
cd /home/ubuntu/auth-app
cp .env.example .env
npm install
node server.js
```

### 3. Puerto en AWS Console

EC2 → Security Groups → Inbound Rules:
- Tipo: **Custom TCP** | Puerto: **3000** | Origen: **0.0.0.0/0**

---

## 🔑 Flujo de autenticación

```
/register  →  Crea cuenta + genera secreto TOTP + muestra QR + códigos de respaldo
     ↓
  Escanea QR con Google Authenticator o Authy
     ↓
/login     →  Ingresa usuario y contraseña
     ↓
/verify-2fa →  Ingresa código de 6 dígitos (o código de respaldo)
     ↓
/dashboard →  ✅ Acceso concedido
```

---

## 🛡️ Mejoras de seguridad implementadas

| Mejora | Detalle |
|---|---|
| Contraseñas hasheadas | bcrypt con factor 12 |
| Secreto de sesión | Variable de entorno (.env) |
| Cookies seguras | `httpOnly` + `sameSite: strict` |
| Error genérico en login | No revela si el usuario existe |
| Validación de usuario | Solo letras, números y guión bajo |
| Códigos de respaldo | 8 códigos de un solo uso |
| PM2 en producción | El servidor se reinicia automáticamente |

---

## 📋 Capturas para el reporte

1. Pantalla de registro
2. Código QR generado + códigos de respaldo
3. Código en Google Authenticator
4. Pantalla de verificación 2FA
5. Dashboard con sesión activa (muestra logins y códigos restantes)
