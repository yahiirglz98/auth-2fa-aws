const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const app = express();
const PORT = 3000;

// Base de datos en memoria (suficiente para práctica)
const users = {};

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'clave-secreta-practica',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 30 } // 30 minutos
}));

// Middleware para proteger rutas
function requireAuth(req, res, next) {
  if (req.session.user && req.session.verified2fa) return next();
  res.redirect('/login');
}

// ─── RUTAS ───────────────────────────────────────────────

// Inicio
app.get('/', (req, res) => {
  res.redirect(req.session.user ? '/dashboard' : '/login');
});

// Registro
app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.render('register', { error: 'Completa todos los campos.' });

  if (users[username])
    return res.render('register', { error: 'El usuario ya existe.' });

  const hash = await bcrypt.hash(password, 10);
  const secret = speakeasy.generateSecret({ name: `Auth2FA (${username})` });

  users[username] = { password: hash, secret: secret.base32, verified: false };

  const qrUrl = await QRCode.toDataURL(secret.otpauth_url);
  res.render('setup-2fa', { username, qrUrl, secret: secret.base32 });
});

// Login
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users[username];

  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.render('login', { error: 'Usuario o contraseña incorrectos.' });

  req.session.user = username;
  req.session.verified2fa = false;
  res.redirect('/verify-2fa');
});

// Verificar 2FA
app.get('/verify-2fa', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('verify-2fa', { error: null });
});

app.post('/verify-2fa', (req, res) => {
  const { token } = req.body;
  const user = users[req.session.user];

  const valid = speakeasy.totp.verify({
    secret: user.secret,
    encoding: 'base32',
    token,
    window: 1
  });

  if (!valid)
    return res.render('verify-2fa', { error: 'Código incorrecto. Intenta de nuevo.' });

  req.session.verified2fa = true;
  res.redirect('/dashboard');
});

// Dashboard (protegido)
app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', { username: req.session.user });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en http://0.0.0.0:${PORT}`);
});
