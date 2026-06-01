require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Base de datos en memoria ───────────────────────────────────────────────
// NOTA: Los usuarios se pierden al reiniciar el servidor.
// Para producción, usar DynamoDB, RDS u otro servicio de AWS.
const users = {};

// ─── Configuración ──────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(
  session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 30, // 30 minutos
      httpOnly: true,          // Previene acceso desde JS del cliente
      sameSite: 'strict'       // Protección CSRF básica
    }
  })
);

// ─── Middleware de protección ────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.user && req.session.verified2fa) {
    return next();
  }
  res.redirect('/login');
}

// ─── Validaciones ────────────────────────────────────────────────────────────
function validatePassword(password) {
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
  return null;
}

/* ═══════════════════════ INICIO ═══════════════════════ */

app.get('/', (req, res) => {
  if (req.session.user && req.session.verified2fa) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

/* ═══════════════════════ REGISTRO ═══════════════════════ */

app.get('/register', (req, res) => {
  if (req.session.user && req.session.verified2fa) return res.redirect('/dashboard');
  res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('register', { error: 'Completa todos los campos' });
  }

  // Validar nombre de usuario (solo letras, números, guiones bajos)
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.render('register', {
      error: 'Usuario: 3-20 caracteres, solo letras, números y guión bajo'
    });
  }

  const passError = validatePassword(password);
  if (passError) return res.render('register', { error: passError });

  if (users[username]) {
    return res.render('register', { error: 'El usuario ya existe' });
  }

  const hashedPassword = await bcrypt.hash(password, 12); // Factor 12 (más seguro que 10)

  // Generar secreto TOTP
  const secret = speakeasy.generateSecret({
    name: `Auth2FA (${username})`,
    issuer: 'Práctica AWS'
  });

  // Generar códigos de respaldo (backup codes)
  const backupCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
  const hashedBackupCodes = await Promise.all(
    backupCodes.map(code => bcrypt.hash(code, 10))
  );

  users[username] = {
    password: hashedPassword,
    secret: secret.base32,
    backupCodes: hashedBackupCodes,
    createdAt: new Date().toISOString(),
    loginCount: 0
  };

  const qrUrl = await QRCode.toDataURL(secret.otpauth_url);

  res.render('setup-2fa', {
    username,
    qrUrl,
    secret: secret.base32,
    backupCodes // Solo se muestran UNA vez
  });
});

/* ═══════════════════════ LOGIN ═══════════════════════ */

app.get('/login', (req, res) => {
  if (req.session.user && req.session.verified2fa) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('login', { error: 'Completa todos los campos' });
  }

  const user = users[username];

  if (!user) {
    // Respuesta genérica para no revelar si el usuario existe
    return res.render('login', { error: 'Usuario o contraseña incorrectos' });
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.render('login', { error: 'Usuario o contraseña incorrectos' });
  }

  req.session.user = username;
  req.session.verified2fa = false;

  res.redirect('/verify-2fa');
});

/* ═══════════════════════ VERIFICAR 2FA ═══════════════════════ */

app.get('/verify-2fa', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.verified2fa) return res.redirect('/dashboard');
  res.render('verify-2fa', { error: null });
});

app.post('/verify-2fa', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const { token } = req.body;
  const user = users[req.session.user];

  if (!token) {
    return res.render('verify-2fa', { error: 'Ingresa el código' });
  }

  // 1. Intentar verificar con TOTP
  const totpVerified = speakeasy.totp.verify({
    secret: user.secret,
    encoding: 'base32',
    token: token.replace(/\s/g, ''),
    window: 1 // Permite ±30 seg de desfase de reloj
  });

  if (totpVerified) {
    req.session.verified2fa = true;
    users[req.session.user].loginCount += 1;
    return res.redirect('/dashboard');
  }

  // 2. Si el TOTP falla, intentar con códigos de respaldo
  const backupInput = token.replace(/\s/g, '').toUpperCase();
  let backupUsed = false;

  for (let i = 0; i < user.backupCodes.length; i++) {
    const match = await bcrypt.compare(backupInput, user.backupCodes[i]);
    if (match) {
      // Invalidar el código usado (reemplazar con hash imposible)
      user.backupCodes[i] = 'USED';
      backupUsed = true;
      break;
    }
  }

  if (backupUsed) {
    req.session.verified2fa = true;
    users[req.session.user].loginCount += 1;
    return res.redirect('/dashboard');
  }

  return res.render('verify-2fa', { error: 'Código inválido. Intenta de nuevo.' });
});

/* ═══════════════════════ DASHBOARD ═══════════════════════ */

app.get('/dashboard', requireAuth, (req, res) => {
  const user = users[req.session.user];
  res.render('dashboard', {
    username: req.session.user,
    loginCount: user.loginCount,
    memberSince: user.createdAt.split('T')[0],
    backupCodesLeft: user.backupCodes.filter(c => c !== 'USED').length
  });
});

/* ═══════════════════════ LOGOUT ═══════════════════════ */

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

/* ═══════════════════════ SERVIDOR ═══════════════════════ */

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'desarrollo'}`);
});
