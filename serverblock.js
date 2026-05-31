// /**
//  * FinBlock v3 — Backend con Firebase Firestore
//  * server.js — Versión corregida para Render.com
//  *
//  * Instalación:
//  *   npm install express socket.io cors jsonwebtoken bcryptjs uuid firebase-admin
//  */

// const express        = require('express');
// const http           = require('http');
// const { Server }     = require('socket.io');
// const cors           = require('cors');
// const jwt            = require('jsonwebtoken');
// const bcrypt         = require('bcryptjs');
// const { v4: uuidv4 } = require('uuid');
// const admin          = require('firebase-admin');

// // ── Firebase Init ──────────────────────────────────────────────────────────
// function initFirebase() {
//   const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

//   if (!raw) {
//     // Fallback: archivo local (desarrollo)
//     try {
//       const serviceAccount = require('./serviceAccountKey.json');
//       admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
//       console.log('✅ Firebase: usando serviceAccountKey.json local');
//       return;
//     } catch {
//       console.error('❌ No se encontró FIREBASE_SERVICE_ACCOUNT ni serviceAccountKey.json');
//       process.exit(1);
//     }
//   }

//   try {
//     // Render a veces escapa las comillas — limpiamos el string
//     let cleaned = raw.trim();

//     // Si viene con comillas envolventes extras, quitarlas
//     if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
//       cleaned = cleaned.slice(1, -1);
//     }

//     // Reemplazar \\n literales por saltos de línea reales en private_key
//     const serviceAccount = JSON.parse(cleaned);

//     if (serviceAccount.private_key) {
//       serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
//     }

//     // Validación mínima
//     const required = ['project_id', 'private_key', 'client_email'];
//     for (const field of required) {
//       if (!serviceAccount[field]) {
//         throw new Error(`Campo faltante en serviceAccount: ${field}`);
//       }
//     }

//     admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
//     console.log(`✅ Firebase: proyecto "${serviceAccount.project_id}" conectado`);
//   } catch (err) {
//     console.error('❌ Error al parsear FIREBASE_SERVICE_ACCOUNT:', err.message);
//     console.error('   Asegúrate de pegar el JSON completo del serviceAccountKey.json');
//     process.exit(1);
//   }
// }

// initFirebase();
// const db = admin.firestore();

// // ── Express + Socket.io ────────────────────────────────────────────────────
// const app    = express();
// const server = http.createServer(app);
// const io     = new Server(server, {
//   cors: { origin: '*', methods: ['GET', 'POST'] },
// });

// app.use(cors());
// app.use(express.json());

// const JWT_SECRET = process.env.JWT_SECRET || 'finblock-firebase-2026';

// // clienteId → socketId activo
// const clienteSocket = new Map();

// // ── Seed admin inicial ─────────────────────────────────────────────────────
// async function seedAdmin() {
//   try {
//     const ref  = db.collection('financieros').doc('gabriel0730');
//     const snap = await ref.get();

//     if (!snap.exists) {
//       const hash = await bcrypt.hash('12345678', 10);
//       await ref.set({
//         id:       'gabriel0730',
//         nombre:   'Gabriel Admin',
//         email:    'gabriel@finblock.com',
//         username: 'gabriel0730',
//         password: hash,
//         creadoEn: admin.firestore.FieldValue.serverTimestamp(),
//       });
//       console.log('✅ Admin creado: gabriel0730 / 12345678');
//     } else {
//       console.log('✅ Admin ya existe: gabriel0730');
//     }
//   } catch (err) {
//     console.error('❌ Error en seedAdmin:', err.message);
//     // No matamos el proceso — el servidor igual arranca
//   }
// }

// // ── JWT Middleware ─────────────────────────────────────────────────────────
// function verificarToken(req, res, next) {
//   const auth = req.headers.authorization;
//   if (!auth?.startsWith('Bearer ')) {
//     return res.status(401).json({ error: 'Sin token' });
//   }
//   try {
//     req.financiero = jwt.verify(auth.slice(7), JWT_SECRET);
//     next();
//   } catch {
//     res.status(401).json({ error: 'Token inválido' });
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // API REST
// // ─────────────────────────────────────────────────────────────────────────────

// // ── Health check ───────────────────────────────────────────────────────────
// app.get('/health', (_, res) => {
//   res.json({ ok: true, clientesActivos: clienteSocket.size, uptime: process.uptime() });
// });

// // ── Login ──────────────────────────────────────────────────────────────────
// app.post('/api/auth/login', async (req, res) => {
//   try {
//     const { username, password } = req.body;
//     if (!username || !password) {
//       return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
//     }

//     const snap = await db.collection('financieros')
//       .where('username', '==', username).limit(1).get();

//     if (snap.empty) return res.status(401).json({ error: 'Credenciales inválidas' });

//     const fin = snap.docs[0].data();
//     const ok  = await bcrypt.compare(password, fin.password);
//     if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

//     const token = jwt.sign(
//       { financieroId: fin.id, nombre: fin.nombre, username: fin.username },
//       JWT_SECRET,
//       { expiresIn: '8h' }
//     );
//     res.json({ token, financiero: { id: fin.id, nombre: fin.nombre, username: fin.username } });
//   } catch (err) {
//     console.error('Error en login:', err.message);
//     res.status(500).json({ error: 'Error interno' });
//   }
// });

// // ── Setup: crear admin por primera vez ────────────────────────────────────
// app.post('/api/auth/setup', async (req, res) => {
//   try {
//     const { username, password } = req.body;
//     if (!username || !password)  return res.status(400).json({ error: 'Datos incompletos' });
//     if (password.length < 8)     return res.status(400).json({ error: 'Contraseña muy corta (mín 8 chars)' });

//     const existing = await db.collection('financieros')
//       .where('username', '==', username.trim()).limit(1).get();
//     if (!existing.empty) return res.status(409).json({ error: 'Usuario ya existe' });

//     const hash = await bcrypt.hash(password, 10);
//     const id   = username.trim().toLowerCase().replace(/\s+/g, '_');

//     await db.collection('financieros').doc(id).set({
//       id,
//       nombre:   `Admin ${username}`,
//       email:    `${id}@finblock.com`,
//       username: username.trim(),
//       password: hash,
//       creadoEn: admin.firestore.FieldValue.serverTimestamp(),
//     });

//     res.json({ ok: true, mensaje: `Admin '${username}' creado correctamente` });
//   } catch (err) {
//     console.error('Error en setup:', err.message);
//     res.status(500).json({ error: 'Error interno' });
//   }
// });

// // ── Verificar PIN del cliente ──────────────────────────────────────────────
// app.post('/api/verificar-pin', async (req, res) => {
//   try {
//     const { deviceToken } = req.body;
//     if (!deviceToken) return res.status(400).json({ error: 'PIN requerido' });

//     const snap = await db.collection('clientes')
//       .where('deviceToken', '==', deviceToken).limit(1).get();

//     if (snap.empty) return res.status(404).json({ error: 'PIN inválido' });

//     const c = snap.docs[0].data();
//     res.json({ ok: true, nombre: c.nombre, estado: c.estado });
//   } catch (err) {
//     console.error('Error en verificar-pin:', err.message);
//     res.status(500).json({ error: 'Error interno' });
//   }
// });

// // ── Listar mis clientes ────────────────────────────────────────────────────
// app.get('/api/mis-clientes', verificarToken, async (req, res) => {
//   try {
//     const snap = await db.collection('clientes')
//       .where('financieroId', '==', req.financiero.financieroId).get();

//     const lista = snap.docs.map(d => {
//       const c = d.data();
//       return {
//         clienteId:   c.clienteId,
//         nombre:      c.nombre,
//         estado:      c.estado,
//         deviceToken: c.deviceToken,
//         conectado:   clienteSocket.has(c.clienteId),
//       };
//     });
//     res.json(lista);
//   } catch (err) {
//     console.error('Error en mis-clientes:', err.message);
//     res.status(500).json({ error: 'Error interno' });
//   }
// });

// // ── Registrar cliente ──────────────────────────────────────────────────────
// app.post('/api/clientes', verificarToken, async (req, res) => {
//   try {
//     const { nombre } = req.body;
//     if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

//     const clienteId   = `cli-${uuidv4().slice(0, 8)}`;
//     const deviceToken = generarPIN();

//     await db.collection('clientes').doc(clienteId).set({
//       clienteId,
//       nombre,
//       financieroId: req.financiero.financieroId,
//       deviceToken,
//       estado:   'activo',
//       creadoEn: admin.firestore.FieldValue.serverTimestamp(),
//     });

//     res.json({ clienteId, nombre, deviceToken });
//   } catch (err) {
//     console.error('Error al registrar cliente:', err.message);
//     res.status(500).json({ error: 'Error interno' });
//   }
// });

// // ── Eliminar cliente ───────────────────────────────────────────────────────
// app.delete('/api/clientes/:id', verificarToken, async (req, res) => {
//   try {
//     const snap = await db.collection('clientes').doc(req.params.id).get();
//     if (!snap.exists) return res.status(404).json({ error: 'No encontrado' });
//     if (snap.data().financieroId !== req.financiero.financieroId)
//       return res.status(403).json({ error: 'Sin permiso' });

//     await db.collection('clientes').doc(req.params.id).delete();
//     res.json({ ok: true });
//   } catch (err) {
//     console.error('Error al eliminar cliente:', err.message);
//     res.status(500).json({ error: 'Error interno' });
//   }
// });

// // ── Bloquear cliente via REST ──────────────────────────────────────────────
// app.post('/api/clientes/:id/bloquear', verificarToken, async (req, res) => {
//   try {
//     const r = await accionCliente(req.params.id, req.financiero.financieroId, 'bloqueado');
//     if (r.error) return res.status(r.status).json({ error: r.error });
//     res.json({ ok: true });
//   } catch (err) {
//     res.status(500).json({ error: 'Error interno' });
//   }
// });

// // ── Desbloquear cliente via REST ───────────────────────────────────────────
// app.post('/api/clientes/:id/desbloquear', verificarToken, async (req, res) => {
//   try {
//     const r = await accionCliente(req.params.id, req.financiero.financieroId, 'activo');
//     if (r.error) return res.status(r.status).json({ error: r.error });
//     res.json({ ok: true });
//   } catch (err) {
//     res.status(500).json({ error: 'Error interno' });
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // HELPERS
// // ─────────────────────────────────────────────────────────────────────────────
// function generarPIN() {
//   const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
//   return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
// }

// async function accionCliente(clienteId, financieroId, nuevoEstado) {
//   const ref  = db.collection('clientes').doc(clienteId);
//   const snap = await ref.get();
//   if (!snap.exists) return { error: 'No encontrado', status: 404 };

//   const c = snap.data();
//   if (c.financieroId !== financieroId) return { error: 'Sin permiso', status: 403 };

//   await ref.update({ estado: nuevoEstado });

//   const evento   = nuevoEstado === 'bloqueado' ? 'orden-bloquear' : 'orden-desbloquear';
//   const mensaje  = nuevoEstado === 'bloqueado'
//     ? 'Dispositivo bloqueado por falta de pago.'
//     : 'Dispositivo desbloqueado. Acceso restaurado.';
//   const socketId = clienteSocket.get(clienteId);
//   if (socketId) {
//     io.to(socketId).emit(evento, { mensaje, timestamp: new Date().toISOString() });
//   }

//   notificarAdmins(financieroId);
//   return { ok: true };
// }

// async function getMisClientes(financieroId) {
//   const snap = await db.collection('clientes')
//     .where('financieroId', '==', financieroId).get();
//   return snap.docs.map(d => {
//     const c = d.data();
//     return {
//       clienteId:   c.clienteId,
//       nombre:      c.nombre,
//       estado:      c.estado,
//       deviceToken: c.deviceToken,
//       conectado:   clienteSocket.has(c.clienteId),
//     };
//   });
// }

// async function notificarAdmins(financieroId) {
//   try {
//     const lista = await getMisClientes(financieroId);
//     io.to(`admin-${financieroId}`).emit('dispositivos-actualizados', lista);
//   } catch (err) {
//     console.error('Error en notificarAdmins:', err.message);
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // SOCKET.IO — autenticación por middleware
// // ─────────────────────────────────────────────────────────────────────────────
// io.use(async (socket, next) => {
//   const { tipo, token } = socket.handshake.auth;

//   if (tipo === 'cliente') {
//     try {
//       const snap = await db.collection('clientes')
//         .where('deviceToken', '==', token).limit(1).get();
//       if (snap.empty) return next(new Error('PIN inválido'));

//       const c = snap.docs[0].data();
//       socket.data.tipo         = 'cliente';
//       socket.data.clienteId    = c.clienteId;
//       socket.data.nombre       = c.nombre;
//       socket.data.financieroId = c.financieroId;
//       socket.data.estado       = c.estado;
//       return next();
//     } catch (err) {
//       return next(new Error('Error al autenticar cliente'));
//     }
//   }

//   if (tipo === 'admin') {
//     try {
//       const decoded = jwt.verify(token, JWT_SECRET);
//       socket.data.tipo         = 'admin';
//       socket.data.financieroId = decoded.financieroId;
//       socket.data.nombre       = decoded.nombre;
//       return next();
//     } catch {
//       return next(new Error('JWT inválido'));
//     }
//   }

//   next(new Error('Tipo de conexión desconocido'));
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // SOCKET.IO — eventos
// // ─────────────────────────────────────────────────────────────────────────────
// io.on('connection', async (socket) => {
//   const { tipo, financieroId, clienteId } = socket.data;

//   // ── CLIENTE ──────────────────────────────────────────────────────────────
//   if (tipo === 'cliente') {
//     clienteSocket.set(clienteId, socket.id);
//     socket.join(`cliente-${clienteId}`);
//     console.log(`[CLIENTE] ${socket.data.nombre} conectado (${clienteId})`);

//     // Re-enviar bloqueo si estaba bloqueado antes de reconectarse
//     if (socket.data.estado === 'bloqueado') {
//       socket.emit('orden-bloquear', {
//         mensaje: 'Dispositivo bloqueado por falta de pago.',
//         timestamp: new Date().toISOString(),
//       });
//     }

//     notificarAdmins(financieroId);

//     socket.on('disconnect', () => {
//       clienteSocket.delete(clienteId);
//       console.log(`[CLIENTE] ${socket.data.nombre} desconectado`);
//       notificarAdmins(financieroId);
//     });
//   }

//   // ── ADMIN ─────────────────────────────────────────────────────────────────
//   if (tipo === 'admin') {
//     socket.join(`admin-${financieroId}`);
//     console.log(`[ADMIN] ${socket.data.nombre} conectado`);

//     // Enviar lista actual al admin
//     const lista = await getMisClientes(financieroId);
//     socket.emit('dispositivos-actualizados', lista);

//     // Bloquear uno
//     socket.on('admin-bloquear', async ({ clienteId: targetId }) => {
//       try {
//         const snap = await db.collection('clientes').doc(targetId).get();
//         if (!snap.exists) return;
//         const c = snap.data();
//         if (c.financieroId !== financieroId) {
//           return socket.emit('error-accion', { mensaje: 'Sin permiso sobre este dispositivo' });
//         }
//         await db.collection('clientes').doc(targetId).update({ estado: 'bloqueado' });
//         io.to(`cliente-${targetId}`).emit('orden-bloquear', {
//           mensaje: 'Dispositivo bloqueado por falta de pago.',
//           timestamp: new Date().toISOString(),
//         });
//         notificarAdmins(financieroId);
//         console.log(`[BLOQUEO] ${c.nombre} por ${socket.data.nombre}`);
//       } catch (err) {
//         console.error('Error en admin-bloquear:', err.message);
//       }
//     });

//     // Desbloquear uno
//     socket.on('admin-desbloquear', async ({ clienteId: targetId }) => {
//       try {
//         const snap = await db.collection('clientes').doc(targetId).get();
//         if (!snap.exists) return;
//         const c = snap.data();
//         if (c.financieroId !== financieroId) {
//           return socket.emit('error-accion', { mensaje: 'Sin permiso sobre este dispositivo' });
//         }
//         await db.collection('clientes').doc(targetId).update({ estado: 'activo' });
//         io.to(`cliente-${targetId}`).emit('orden-desbloquear', {
//           mensaje: 'Dispositivo desbloqueado. Acceso restaurado.',
//           timestamp: new Date().toISOString(),
//         });
//         notificarAdmins(financieroId);
//         console.log(`[DESBLOQUEO] ${c.nombre} por ${socket.data.nombre}`);
//       } catch (err) {
//         console.error('Error en admin-desbloquear:', err.message);
//       }
//     });

//     // Bloquear todos
//     socket.on('admin-bloquear-todos', async () => {
//       try {
//         const snap = await db.collection('clientes')
//           .where('financieroId', '==', financieroId).get();
//         const batch = db.batch();
//         snap.docs.forEach(d => batch.update(d.ref, { estado: 'bloqueado' }));
//         await batch.commit();
//         snap.docs.forEach(d => {
//           io.to(`cliente-${d.data().clienteId}`).emit('orden-bloquear', {
//             mensaje: 'Bloqueado por falta de pago.',
//             timestamp: new Date().toISOString(),
//           });
//         });
//         notificarAdmins(financieroId);
//         console.log(`[BLOQUEO-TODOS] por ${socket.data.nombre}`);
//       } catch (err) {
//         console.error('Error en admin-bloquear-todos:', err.message);
//       }
//     });

//     // Desbloquear todos
//     socket.on('admin-desbloquear-todos', async () => {
//       try {
//         const snap = await db.collection('clientes')
//           .where('financieroId', '==', financieroId).get();
//         const batch = db.batch();
//         snap.docs.forEach(d => batch.update(d.ref, { estado: 'activo' }));
//         await batch.commit();
//         snap.docs.forEach(d => {
//           io.to(`cliente-${d.data().clienteId}`).emit('orden-desbloquear', {
//             mensaje: 'Dispositivo desbloqueado.',
//             timestamp: new Date().toISOString(),
//           });
//         });
//         notificarAdmins(financieroId);
//         console.log(`[DESBLOQUEO-TODOS] por ${socket.data.nombre}`);
//       } catch (err) {
//         console.error('Error en admin-desbloquear-todos:', err.message);
//       }
//     });

//     socket.on('disconnect', () => {
//       console.log(`[ADMIN] ${socket.data.nombre} desconectado`);
//     });
//   }
// });

// // ── Arranque ───────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 3000;
// seedAdmin().then(() => {
//   server.listen(PORT, () => {
//     console.log(`\n🚀 FinBlock v3 corriendo en http://localhost:${PORT}`);
//     console.log('   Admin por defecto: gabriel0730 / 12345678\n');
//   });
// });


const express        = require('express');
const http           = require('http');
const { Server }     = require('socket.io');
const cors           = require('cors');
const jwt            = require('jsonwebtoken');
const bcrypt         = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const admin          = require('firebase-admin');
const fs             = require('fs');

// ── Firebase Init ──────────────────────────────────────────────────────────
function initFirebase() {
  const secretPath = '/etc/secrets/serviceAccountKey.json';
  if (fs.existsSync(secretPath)) {
    try {
      const sa = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(sa) });
      console.log(`✅ Firebase [SecretFile]: ${sa.project_id}`);
      return;
    } catch (err) { console.error('❌ SecretFile:', err.message); }
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      let cleaned = raw.trim();
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);
      const sa = JSON.parse(cleaned);
      if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      admin.initializeApp({ credential: admin.credential.cert(sa) });
      console.log(`✅ Firebase [ENV]: ${sa.project_id}`);
      return;
    } catch (err) { console.error('❌ ENV:', err.message); }
  }

  try {
    const sa = require('./serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    console.log('✅ Firebase [local]');
  } catch {
    console.error('❌ Sin credenciales Firebase');
    process.exit(1);
  }
}

initFirebase();
const db = admin.firestore();

// ── Express ────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ══════════════════════════════════════════════════════════════
// CORS — permite cualquier origen (Ionic dev + producción)
// ══════════════════════════════════════════════════════════════
const corsOptions = {
  origin: function (origin, callback) {
    // Permite requests sin origin (Postman, apps móviles nativas)
    // y cualquier origin web
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Responder explícitamente a todas las peticiones OPTIONS (preflight)
app.options('/{*path}', cors(corsOptions));

app.use(express.json());

// ── Socket.io con CORS abierto ─────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false,
  },
});

const JWT_SECRET    = process.env.JWT_SECRET || 'finblock-firebase-2026';
const clienteSocket = new Map();

// ── Seed admin ─────────────────────────────────────────────────────────────
async function seedAdmin() {
  try {
    const ref  = db.collection('financieros').doc('gabriel0730');
    const snap = await ref.get();
    if (!snap.exists) {
      const hash = await bcrypt.hash('12345678', 10);
      await ref.set({ id: 'gabriel0730', nombre: 'Gabriel Admin', email: 'gabriel@finblock.com', username: 'gabriel0730', password: hash, creadoEn: admin.firestore.FieldValue.serverTimestamp() });
      console.log('✅ Admin creado: gabriel0730 / 12345678');
    } else {
      console.log('✅ Admin ya existe');
    }
  } catch (err) { console.error('❌ seedAdmin:', err.message); }
}

// ── JWT Middleware ─────────────────────────────────────────────────────────
function verificarToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Sin token' });
  try { req.financiero = jwt.verify(auth.slice(7), JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido' }); }
}

// ── REST ───────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, activos: clienteSocket.size, uptime: process.uptime() }));

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Datos requeridos' });
    const snap = await db.collection('financieros').where('username', '==', username).limit(1).get();
    if (snap.empty) return res.status(401).json({ error: 'Credenciales inválidas' });
    const fin = snap.docs[0].data();
    if (!(await bcrypt.compare(password, fin.password))) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = jwt.sign({ financieroId: fin.id, nombre: fin.nombre, username: fin.username }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, financiero: { id: fin.id, nombre: fin.nombre, username: fin.username } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/setup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Datos incompletos' });
    if (password.length < 8) return res.status(400).json({ error: 'Contraseña muy corta' });
    const existing = await db.collection('financieros').where('username', '==', username.trim()).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Usuario ya existe' });
    const hash = await bcrypt.hash(password, 10);
    const id = username.trim().toLowerCase().replace(/\s+/g, '_');
    await db.collection('financieros').doc(id).set({ id, nombre: `Admin ${username}`, email: `${id}@finblock.com`, username: username.trim(), password: hash, creadoEn: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ ok: true, mensaje: `Admin '${username}' creado` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/verificar-pin', async (req, res) => {
  try {
    const { deviceToken } = req.body;
    if (!deviceToken) return res.status(400).json({ error: 'PIN requerido' });
    const snap = await db.collection('clientes').where('deviceToken', '==', deviceToken).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'PIN inválido' });
    const c = snap.docs[0].data();
    res.json({ ok: true, nombre: c.nombre, estado: c.estado });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mis-clientes', verificarToken, async (req, res) => {
  try {
    const snap = await db.collection('clientes').where('financieroId', '==', req.financiero.financieroId).get();
    res.json(snap.docs.map(d => { const c = d.data(); return { clienteId: c.clienteId, nombre: c.nombre, estado: c.estado, deviceToken: c.deviceToken, conectado: clienteSocket.has(c.clienteId) }; }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clientes', verificarToken, async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const clienteId = `cli-${uuidv4().slice(0, 8)}`;
    const deviceToken = generarPIN();
    await db.collection('clientes').doc(clienteId).set({ clienteId, nombre, financieroId: req.financiero.financieroId, deviceToken, estado: 'activo', creadoEn: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ clienteId, nombre, deviceToken });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/clientes/:id', verificarToken, async (req, res) => {
  try {
    const snap = await db.collection('clientes').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'No encontrado' });
    if (snap.data().financieroId !== req.financiero.financieroId) return res.status(403).json({ error: 'Sin permiso' });
    await db.collection('clientes').doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clientes/:id/bloquear', verificarToken, async (req, res) => {
  try {
    const r = await accionCliente(req.params.id, req.financiero.financieroId, 'bloqueado');
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clientes/:id/desbloquear', verificarToken, async (req, res) => {
  try {
    const r = await accionCliente(req.params.id, req.financiero.financieroId, 'activo');
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Helpers ────────────────────────────────────────────────────────────────
function generarPIN() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function accionCliente(clienteId, financieroId, nuevoEstado) {
  const ref = db.collection('clientes').doc(clienteId);
  const snap = await ref.get();
  if (!snap.exists) return { error: 'No encontrado', status: 404 };
  const c = snap.data();
  if (c.financieroId !== financieroId) return { error: 'Sin permiso', status: 403 };
  await ref.update({ estado: nuevoEstado });
  const evento  = nuevoEstado === 'bloqueado' ? 'orden-bloquear' : 'orden-desbloquear';
  const mensaje = nuevoEstado === 'bloqueado' ? 'Dispositivo bloqueado por falta de pago.' : 'Dispositivo desbloqueado.';
  const sid = clienteSocket.get(clienteId);
  if (sid) io.to(sid).emit(evento, { mensaje, timestamp: new Date().toISOString() });
  notificarAdmins(financieroId);
  return { ok: true };
}

async function getMisClientes(financieroId) {
  const snap = await db.collection('clientes').where('financieroId', '==', financieroId).get();
  return snap.docs.map(d => { const c = d.data(); return { clienteId: c.clienteId, nombre: c.nombre, estado: c.estado, deviceToken: c.deviceToken, conectado: clienteSocket.has(c.clienteId) }; });
}

async function notificarAdmins(financieroId) {
  try { io.to(`admin-${financieroId}`).emit('dispositivos-actualizados', await getMisClientes(financieroId)); }
  catch (err) { console.error('notificarAdmins:', err.message); }
}

// ── Socket.io auth ─────────────────────────────────────────────────────────
io.use(async (socket, next) => {
  const { tipo, token } = socket.handshake.auth;
  if (tipo === 'cliente') {
    try {
      const snap = await db.collection('clientes').where('deviceToken', '==', token).limit(1).get();
      if (snap.empty) return next(new Error('PIN inválido'));
      const c = snap.docs[0].data();
      Object.assign(socket.data, { tipo: 'cliente', clienteId: c.clienteId, nombre: c.nombre, financieroId: c.financieroId, estado: c.estado });
      return next();
    } catch { return next(new Error('Error auth cliente')); }
  }
  if (tipo === 'admin') {
    try {
      const d = jwt.verify(token, JWT_SECRET);
      Object.assign(socket.data, { tipo: 'admin', financieroId: d.financieroId, nombre: d.nombre });
      return next();
    } catch { return next(new Error('JWT inválido')); }
  }
  next(new Error('Tipo desconocido'));
});

// ── Socket.io eventos ──────────────────────────────────────────────────────
io.on('connection', async (socket) => {
  const { tipo, financieroId, clienteId } = socket.data;

  if (tipo === 'cliente') {
    clienteSocket.set(clienteId, socket.id);
    socket.join(`cliente-${clienteId}`);
    console.log(`[CLIENTE] ${socket.data.nombre} conectado`);
    if (socket.data.estado === 'bloqueado') socket.emit('orden-bloquear', { mensaje: 'Dispositivo bloqueado por falta de pago.', timestamp: new Date().toISOString() });
    notificarAdmins(financieroId);
    socket.on('disconnect', () => { clienteSocket.delete(clienteId); notificarAdmins(financieroId); });
  }

  if (tipo === 'admin') {
    socket.join(`admin-${financieroId}`);
    console.log(`[ADMIN] ${socket.data.nombre} conectado`);
    socket.emit('dispositivos-actualizados', await getMisClientes(financieroId));

    socket.on('admin-bloquear', async ({ clienteId: t }) => {
      try {
        const snap = await db.collection('clientes').doc(t).get();
        if (!snap.exists) return;
        const c = snap.data();
        if (c.financieroId !== financieroId) return socket.emit('error-accion', { mensaje: 'Sin permiso' });
        await db.collection('clientes').doc(t).update({ estado: 'bloqueado' });
        io.to(`cliente-${t}`).emit('orden-bloquear', { mensaje: 'Dispositivo bloqueado por falta de pago.', timestamp: new Date().toISOString() });
        notificarAdmins(financieroId);
      } catch (err) { console.error('admin-bloquear:', err.message); }
    });

    socket.on('admin-desbloquear', async ({ clienteId: t }) => {
      try {
        const snap = await db.collection('clientes').doc(t).get();
        if (!snap.exists) return;
        const c = snap.data();
        if (c.financieroId !== financieroId) return socket.emit('error-accion', { mensaje: 'Sin permiso' });
        await db.collection('clientes').doc(t).update({ estado: 'activo' });
        io.to(`cliente-${t}`).emit('orden-desbloquear', { mensaje: 'Dispositivo desbloqueado.', timestamp: new Date().toISOString() });
        notificarAdmins(financieroId);
      } catch (err) { console.error('admin-desbloquear:', err.message); }
    });

    socket.on('admin-bloquear-todos', async () => {
      try {
        const snap = await db.collection('clientes').where('financieroId', '==', financieroId).get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.update(d.ref, { estado: 'bloqueado' }));
        await batch.commit();
        snap.docs.forEach(d => io.to(`cliente-${d.data().clienteId}`).emit('orden-bloquear', { mensaje: 'Bloqueado por falta de pago.', timestamp: new Date().toISOString() }));
        notificarAdmins(financieroId);
      } catch (err) { console.error('bloquear-todos:', err.message); }
    });

    socket.on('admin-desbloquear-todos', async () => {
      try {
        const snap = await db.collection('clientes').where('financieroId', '==', financieroId).get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.update(d.ref, { estado: 'activo' }));
        await batch.commit();
        snap.docs.forEach(d => io.to(`cliente-${d.data().clienteId}`).emit('orden-desbloquear', { mensaje: 'Dispositivo desbloqueado.', timestamp: new Date().toISOString() }));
        notificarAdmins(financieroId);
      } catch (err) { console.error('desbloquear-todos:', err.message); }
    });

    socket.on('disconnect', () => console.log(`[ADMIN] ${socket.data.nombre} desconectado`));
  }
});

const PORT = process.env.PORT || 3000;
seedAdmin().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 FinBlock v3 en http://localhost:${PORT}`);
    console.log('   Admin: gabriel0730 / 12345678\n');
  });
});


// const express        = require('express');
// const http           = require('http');
// const { Server }     = require('socket.io');
// const cors           = require('cors');
// const jwt            = require('jsonwebtoken');
// const bcrypt         = require('bcryptjs');
// const { v4: uuidv4 } = require('uuid');
// const admin          = require('firebase-admin');
// const fs             = require('fs');

// // ── Firebase Init ──────────────────────────────────────────────────────────
// function initFirebase() {
//   const secretPath = '/etc/secrets/serviceAccountKey.json';
//   if (fs.existsSync(secretPath)) {
//     try {
//       const sa = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
//       admin.initializeApp({ credential: admin.credential.cert(sa) });
//       console.log(`✅ Firebase [SecretFile]: ${sa.project_id}`);
//       return;
//     } catch (err) { console.error('❌ SecretFile:', err.message); }
//   }

//   const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
//   if (raw) {
//     try {
//       let cleaned = raw.trim();
//       if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);
//       const sa = JSON.parse(cleaned);
//       if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
//       admin.initializeApp({ credential: admin.credential.cert(sa) });
//       console.log(`✅ Firebase [ENV]: ${sa.project_id}`);
//       return;
//     } catch (err) { console.error('❌ ENV:', err.message); }
//   }

//   try {
//     const sa = require('./serviceAccountKey.json');
//     admin.initializeApp({ credential: admin.credential.cert(sa) });
//     console.log('✅ Firebase [local]');
//   } catch {
//     console.error('❌ Sin credenciales Firebase');
//     process.exit(1);
//   }
// }

// initFirebase();
// const db = admin.firestore();

// // ── Express ────────────────────────────────────────────────────────────────
// const app    = express();
// const server = http.createServer(app);

// const corsOptions = {
//   origin: function (origin, callback) { callback(null, true); },
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
//   credentials: true,
//   optionsSuccessStatus: 200,
// };

// app.use(cors(corsOptions));
// app.options('/{*path}', cors(corsOptions));
// app.use(express.json());

// const io = new Server(server, {
//   cors: { origin: '*', methods: ['GET', 'POST'], credentials: false },
// });

// const JWT_SECRET    = process.env.JWT_SECRET || 'finblock-firebase-2026';
// const clienteSocket = new Map();

// // ── Seed admin ─────────────────────────────────────────────────────────────
// async function seedAdmin() {
//   try {
//     const ref  = db.collection('financieros').doc('gabriel0730');
//     const snap = await ref.get();
//     if (!snap.exists) {
//       const hash = await bcrypt.hash('12345678', 10);
//       await ref.set({ id: 'gabriel0730', nombre: 'Gabriel Admin', email: 'gabriel@finblock.com', username: 'gabriel0730', password: hash, creadoEn: admin.firestore.FieldValue.serverTimestamp() });
//       console.log('✅ Admin creado: gabriel0730 / 12345678');
//     } else {
//       console.log('✅ Admin ya existe');
//     }
//   } catch (err) { console.error('❌ seedAdmin:', err.message); }
// }

// // ── JWT Middleware ─────────────────────────────────────────────────────────
// function verificarToken(req, res, next) {
//   const auth = req.headers.authorization;
//   if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Sin token' });
//   try { req.financiero = jwt.verify(auth.slice(7), JWT_SECRET); next(); }
//   catch { res.status(401).json({ error: 'Token inválido' }); }
// }

// // ── REST ───────────────────────────────────────────────────────────────────
// app.get('/health', (_, res) => res.json({ ok: true, activos: clienteSocket.size, uptime: process.uptime() }));

// app.post('/api/auth/login', async (req, res) => {
//   try {
//     const { username, password } = req.body;
//     if (!username || !password) return res.status(400).json({ error: 'Datos requeridos' });
//     const snap = await db.collection('financieros').where('username', '==', username).limit(1).get();
//     if (snap.empty) return res.status(401).json({ error: 'Credenciales inválidas' });
//     const fin = snap.docs[0].data();
//     if (!(await bcrypt.compare(password, fin.password))) return res.status(401).json({ error: 'Credenciales inválidas' });
//     const token = jwt.sign({ financieroId: fin.id, nombre: fin.nombre, username: fin.username }, JWT_SECRET, { expiresIn: '8h' });
//     res.json({ token, financiero: { id: fin.id, nombre: fin.nombre, username: fin.username } });
//   } catch (err) { res.status(500).json({ error: err.message }); }
// });

// app.post('/api/auth/setup', async (req, res) => {
//   try {
//     const { username, password } = req.body;
//     if (!username || !password) return res.status(400).json({ error: 'Datos incompletos' });
//     if (password.length < 8) return res.status(400).json({ error: 'Contraseña muy corta' });
//     const existing = await db.collection('financieros').where('username', '==', username.trim()).limit(1).get();
//     if (!existing.empty) return res.status(409).json({ error: 'Usuario ya existe' });
//     const hash = await bcrypt.hash(password, 10);
//     const id = username.trim().toLowerCase().replace(/\s+/g, '_');
//     await db.collection('financieros').doc(id).set({ id, nombre: `Admin ${username}`, email: `${id}@finblock.com`, username: username.trim(), password: hash, creadoEn: admin.firestore.FieldValue.serverTimestamp() });
//     res.json({ ok: true, mensaje: `Admin '${username}' creado` });
//   } catch (err) { res.status(500).json({ error: err.message }); }
// });

// app.post('/api/verificar-pin', async (req, res) => {
//   try {
//     const { deviceToken } = req.body;
//     if (!deviceToken) return res.status(400).json({ error: 'PIN requerido' });
//     const snap = await db.collection('clientes').where('deviceToken', '==', deviceToken).limit(1).get();
//     if (snap.empty) return res.status(404).json({ error: 'PIN inválido' });
//     const c = snap.docs[0].data();
//     res.json({ ok: true, nombre: c.nombre, estado: c.estado });
//   } catch (err) { res.status(500).json({ error: err.message }); }
// });

// app.get('/api/mis-clientes', verificarToken, async (req, res) => {
//   try {
//     const lista = await getMisClientes(req.financiero.financieroId);
//     res.json(lista);
//   } catch (err) { res.status(500).json({ error: err.message }); }
// });

// app.post('/api/clientes', verificarToken, async (req, res) => {
//   try {
//     const { nombre } = req.body;
//     if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
//     const clienteId   = `cli-${uuidv4().slice(0, 8)}`;
//     const deviceToken = generarPIN();
//     await db.collection('clientes').doc(clienteId).set({
//       clienteId, nombre,
//       financieroId: req.financiero.financieroId,
//       deviceToken,
//       estado: 'activo',
//       creadoEn: admin.firestore.FieldValue.serverTimestamp()
//     });
//     res.json({ clienteId, nombre, deviceToken });
//   } catch (err) { res.status(500).json({ error: err.message }); }
// });

// app.delete('/api/clientes/:id', verificarToken, async (req, res) => {
//   try {
//     const snap = await db.collection('clientes').doc(req.params.id).get();
//     if (!snap.exists) return res.status(404).json({ error: 'No encontrado' });
//     if (snap.data().financieroId !== req.financiero.financieroId) return res.status(403).json({ error: 'Sin permiso' });
//     await db.collection('clientes').doc(req.params.id).delete();
//     res.json({ ok: true });
//   } catch (err) { res.status(500).json({ error: err.message }); }
// });

// app.post('/api/clientes/:id/bloquear', verificarToken, async (req, res) => {
//   try {
//     const r = await accionCliente(req.params.id, req.financiero.financieroId, 'bloqueado', null);
//     if (r.error) return res.status(r.status).json({ error: r.error });
//     res.json({ ok: true });
//   } catch (err) { res.status(500).json({ error: err.message }); }
// });

// app.post('/api/clientes/:id/desbloquear', verificarToken, async (req, res) => {
//   try {
//     const diasGracia = req.body.diasGracia || 5;
//     const r = await accionCliente(req.params.id, req.financiero.financieroId, 'activo', diasGracia);
//     if (r.error) return res.status(r.status).json({ error: r.error });
//     res.json({ ok: true });
//   } catch (err) { res.status(500).json({ error: err.message }); }
// });

// // ── Helpers ────────────────────────────────────────────────────────────────
// function generarPIN() {
//   const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
//   return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
// }

// // ★ accionCliente actualizado con diasGracia ★
// async function accionCliente(clienteId, financieroId, nuevoEstado, diasGracia) {
//   const ref  = db.collection('clientes').doc(clienteId);
//   const snap = await ref.get();
//   if (!snap.exists) return { error: 'No encontrado', status: 404 };
//   const c = snap.data();
//   if (c.financieroId !== financieroId) return { error: 'Sin permiso', status: 403 };

//   const updateData = { estado: nuevoEstado };

//   // Si se desbloquea con días de gracia, calcular vencimiento
//   if (nuevoEstado === 'activo' && diasGracia) {
//     updateData.vencimiento = Date.now() + (diasGracia * 24 * 60 * 60 * 1000);
//     updateData.diasGracia  = diasGracia;
//   }

//   // Si se bloquea, limpiar vencimiento
//   if (nuevoEstado === 'bloqueado') {
//     updateData.vencimiento = null;
//     updateData.diasGracia  = null;
//   }

//   await ref.update(updateData);

//   const evento  = nuevoEstado === 'bloqueado' ? 'orden-bloquear' : 'orden-desbloquear';
//   const mensaje = nuevoEstado === 'bloqueado'
//     ? 'Dispositivo bloqueado por falta de pago.'
//     : 'Dispositivo desbloqueado.';

//   const payload = {
//     mensaje,
//     timestamp: new Date().toISOString(),
//     ...(nuevoEstado === 'activo' && diasGracia ? {
//       diasGracia,
//       vencimiento: updateData.vencimiento
//     } : {})
//   };

//   const sid = clienteSocket.get(clienteId);
//   if (sid) io.to(sid).emit(evento, payload);

//   notificarAdmins(financieroId);
//   return { ok: true };
// }

// // ★ getMisClientes actualizado con vencimiento ★
// async function getMisClientes(financieroId) {
//   const snap = await db.collection('clientes').where('financieroId', '==', financieroId).get();
//   return snap.docs.map(d => {
//     const c = d.data();
//     return {
//       clienteId:   c.clienteId,
//       nombre:      c.nombre,
//       estado:      c.estado,
//       deviceToken: c.deviceToken,
//       conectado:   clienteSocket.has(c.clienteId),
//       diasGracia:  c.diasGracia  || null,
//       vencimiento: c.vencimiento || null,
//     };
//   });
// }

// async function notificarAdmins(financieroId) {
//   try { io.to(`admin-${financieroId}`).emit('dispositivos-actualizados', await getMisClientes(financieroId)); }
//   catch (err) { console.error('notificarAdmins:', err.message); }
// }

// // ── Socket.io auth ─────────────────────────────────────────────────────────
// io.use(async (socket, next) => {
//   const { tipo, token } = socket.handshake.auth;
//   if (tipo === 'cliente') {
//     try {
//       const snap = await db.collection('clientes').where('deviceToken', '==', token).limit(1).get();
//       if (snap.empty) return next(new Error('PIN inválido'));
//       const c = snap.docs[0].data();
//       Object.assign(socket.data, { tipo: 'cliente', clienteId: c.clienteId, nombre: c.nombre, financieroId: c.financieroId, estado: c.estado });
//       return next();
//     } catch { return next(new Error('Error auth cliente')); }
//   }
//   if (tipo === 'admin') {
//     try {
//       const d = jwt.verify(token, JWT_SECRET);
//       Object.assign(socket.data, { tipo: 'admin', financieroId: d.financieroId, nombre: d.nombre });
//       return next();
//     } catch { return next(new Error('JWT inválido')); }
//   }
//   next(new Error('Tipo desconocido'));
// });

// // ── Socket.io eventos ──────────────────────────────────────────────────────
// io.on('connection', async (socket) => {
//   const { tipo, financieroId, clienteId } = socket.data;

//   // ── CLIENTE ───────────────────────────────────────────────────────────────
//   if (tipo === 'cliente') {
//     clienteSocket.set(clienteId, socket.id);
//     socket.join(`cliente-${clienteId}`);
//     console.log(`[CLIENTE] ${socket.data.nombre} conectado`);

//     // Si está bloqueado al conectar, enviar orden inmediata
//     if (socket.data.estado === 'bloqueado') {
//       socket.emit('orden-bloquear', {
//         mensaje: 'Dispositivo bloqueado por falta de pago.',
//         timestamp: new Date().toISOString()
//       });
//     }

//     notificarAdmins(financieroId);
//     socket.on('disconnect', () => {
//       clienteSocket.delete(clienteId);
//       notificarAdmins(financieroId);
//     });
//   }

//   // ── ADMIN ─────────────────────────────────────────────────────────────────
//   if (tipo === 'admin') {
//     socket.join(`admin-${financieroId}`);
//     console.log(`[ADMIN] ${socket.data.nombre} conectado`);
//     socket.emit('dispositivos-actualizados', await getMisClientes(financieroId));

//     // Bloquear cliente individual
//     socket.on('admin-bloquear', async ({ clienteId: t }) => {
//       try {
//         const snap = await db.collection('clientes').doc(t).get();
//         if (!snap.exists) return;
//         const c = snap.data();
//         if (c.financieroId !== financieroId)
//           return socket.emit('error-accion', { mensaje: 'Sin permiso' });

//         await db.collection('clientes').doc(t).update({
//           estado:      'bloqueado',
//           vencimiento: null,
//           diasGracia:  null
//         });

//         io.to(`cliente-${t}`).emit('orden-bloquear', {
//           mensaje:   'Dispositivo bloqueado por falta de pago.',
//           timestamp: new Date().toISOString()
//         });

//         notificarAdmins(financieroId);
//       } catch (err) { console.error('admin-bloquear:', err.message); }
//     });

//     // ★ Desbloquear cliente con días de gracia ★
//     socket.on('admin-desbloquear', async ({ clienteId: t, diasGracia }) => {
//       try {
//         const snap = await db.collection('clientes').doc(t).get();
//         if (!snap.exists) return;
//         const c = snap.data();
//         if (c.financieroId !== financieroId)
//           return socket.emit('error-accion', { mensaje: 'Sin permiso' });

//         const dias        = diasGracia || 5;
//         const vencimiento = Date.now() + (dias * 24 * 60 * 60 * 1000);

//         await db.collection('clientes').doc(t).update({
//           estado:      'activo',
//           diasGracia:  dias,
//           vencimiento: vencimiento
//         });

//         io.to(`cliente-${t}`).emit('orden-desbloquear', {
//           mensaje:     'Dispositivo desbloqueado.',
//           timestamp:   new Date().toISOString(),
//           diasGracia:  dias,
//           vencimiento: vencimiento
//         });

//         notificarAdmins(financieroId);
//       } catch (err) { console.error('admin-desbloquear:', err.message); }
//     });

//     // Bloquear todos
//     socket.on('admin-bloquear-todos', async () => {
//       try {
//         const snap = await db.collection('clientes')
//           .where('financieroId', '==', financieroId).get();
//         const batch = db.batch();
//         snap.docs.forEach(d => batch.update(d.ref, {
//           estado: 'bloqueado', vencimiento: null, diasGracia: null
//         }));
//         await batch.commit();
//         snap.docs.forEach(d => io.to(`cliente-${d.data().clienteId}`).emit('orden-bloquear', {
//           mensaje: 'Bloqueado por falta de pago.', timestamp: new Date().toISOString()
//         }));
//         notificarAdmins(financieroId);
//       } catch (err) { console.error('bloquear-todos:', err.message); }
//     });

//     // ★ Desbloquear todos con días de gracia ★
//     socket.on('admin-desbloquear-todos', async ({ diasGracia } = {}) => {
//       try {
//         const dias        = diasGracia || 5;
//         const vencimiento = Date.now() + (dias * 24 * 60 * 60 * 1000);

//         const snap = await db.collection('clientes')
//           .where('financieroId', '==', financieroId).get();
//         const batch = db.batch();
//         snap.docs.forEach(d => batch.update(d.ref, {
//           estado: 'activo', diasGracia: dias, vencimiento: vencimiento
//         }));
//         await batch.commit();

//         snap.docs.forEach(d => io.to(`cliente-${d.data().clienteId}`).emit('orden-desbloquear', {
//           mensaje:     'Dispositivo desbloqueado.',
//           timestamp:   new Date().toISOString(),
//           diasGracia:  dias,
//           vencimiento: vencimiento
//         }));

//         notificarAdmins(financieroId);
//       } catch (err) { console.error('desbloquear-todos:', err.message); }
//     });

//     socket.on('disconnect', () => console.log(`[ADMIN] ${socket.data.nombre} desconectado`));
//   }
// });

// const PORT = process.env.PORT || 3000;
// seedAdmin().then(() => {
//   server.listen(PORT, () => {
//     console.log(`\n🚀 FinBlock v3 en http://localhost:${PORT}`);
//     console.log('   Admin: gabriel0730 / 12345678\n');
//   });
// });
