// /**
//  * FinBlock — Servidor Backend
//  * Node.js + Socket.io
//  * Gestiona la comunicación en tiempo real entre el Panel Admin y los dispositivos cliente.
//  * 
//  * Instalación:  npm install express socket.io cors
//  * Ejecución:    node server.js
//  */

// const express    = require('express');
// const http       = require('http');
// const { Server } = require('socket.io');
// const cors       = require('cors');

// const app    = express();
// const server = http.createServer(app);

// // ── Configuración de Socket.io ──────────────────────────────────────────────
// const io = new Server(server, {
//   cors: {
//     origin: '*',          // En producción restringe al dominio real
//     methods: ['GET', 'POST'],
//   },
// });

// app.use(cors());
// app.use(express.json());

// // ── Estado en memoria de dispositivos ──────────────────────────────────────
// // En producción usa Redis o base de datos
// const devices = new Map();
// // Estructura: { socketId, deviceId, nombre, estado: 'activo'|'bloqueado', connectedAt }

// // ── API REST básica ────────────────────────────────────────────────────────
// app.get('/api/devices', (req, res) => {
//   res.json(Array.from(devices.values()));
// });

// app.get('/health', (req, res) => {
//   res.json({ status: 'ok', devices: devices.size, uptime: process.uptime() });
// });

// // ── Lógica de Socket.io ────────────────────────────────────────────────────
// io.on('connection', (socket) => {
//   console.log(`[+] Nueva conexión: ${socket.id}`);

//   // ── El dispositivo cliente se registra ──────────────────────────────────
//   socket.on('registrar-dispositivo', (data) => {
//     const { deviceId, nombre } = data;
//     const device = {
//       socketId:    socket.id,
//       deviceId:    deviceId || socket.id,
//       nombre:      nombre   || `Dispositivo-${socket.id.slice(0, 6)}`,
//       estado:      'activo',
//       connectedAt: new Date().toISOString(),
//     };
//     devices.set(socket.id, device);
//     socket.join('clientes');  // room de dispositivos cliente

//     console.log(`[CLIENTE] Registrado: ${device.nombre} (${device.deviceId})`);

//     // Notifica a todos los admins que hay un nuevo dispositivo
//     io.to('admins').emit('dispositivos-actualizados', Array.from(devices.values()));
//     // Confirma al cliente su registro
//     socket.emit('registro-confirmado', device);
//   });

//   // ── El panel admin se identifica ────────────────────────────────────────
//   socket.on('registrar-admin', () => {
//     socket.join('admins');
//     console.log(`[ADMIN] Panel conectado: ${socket.id}`);
//     // Envía el estado actual de todos los dispositivos al admin recién conectado
//     socket.emit('dispositivos-actualizados', Array.from(devices.values()));
//   });

//   // ── Admin ordena BLOQUEAR un dispositivo específico ─────────────────────
//   socket.on('admin-bloquear', ({ targetSocketId, deviceId }) => {
//     console.log(`[ADMIN] Orden de BLOQUEO → ${targetSocketId || deviceId}`);

//     if (targetSocketId) {
//       // Actualiza estado en memoria
//       if (devices.has(targetSocketId)) {
//         devices.get(targetSocketId).estado = 'bloqueado';
//       }
//       // Envía la orden al dispositivo específico
//       io.to(targetSocketId).emit('orden-bloquear', {
//         mensaje: 'Dispositivo bloqueado por falta de pago.',
//         timestamp: new Date().toISOString(),
//       });
//     } else {
//       // Si no hay target, bloquea TODOS los clientes (broadcast)
//       io.to('clientes').emit('orden-bloquear', {
//         mensaje: 'Dispositivo bloqueado por falta de pago.',
//         timestamp: new Date().toISOString(),
//       });
//       devices.forEach((d) => { d.estado = 'bloqueado'; });
//     }

//     // Notifica a los admins el estado actualizado
//     io.to('admins').emit('dispositivos-actualizados', Array.from(devices.values()));
//   });

//   // ── Admin ordena DESBLOQUEAR un dispositivo específico ──────────────────
//   socket.on('admin-desbloquear', ({ targetSocketId, deviceId }) => {
//     console.log(`[ADMIN] Orden de DESBLOQUEO → ${targetSocketId || deviceId}`);

//     if (targetSocketId) {
//       if (devices.has(targetSocketId)) {
//         devices.get(targetSocketId).estado = 'activo';
//       }
//       io.to(targetSocketId).emit('orden-desbloquear', {
//         mensaje: 'Dispositivo desbloqueado. Acceso restaurado.',
//         timestamp: new Date().toISOString(),
//       });
//     } else {
//       io.to('clientes').emit('orden-desbloquear', {
//         mensaje: 'Dispositivo desbloqueado. Acceso restaurado.',
//         timestamp: new Date().toISOString(),
//       });
//       devices.forEach((d) => { d.estado = 'activo'; });
//     }

//     io.to('admins').emit('dispositivos-actualizados', Array.from(devices.values()));
//   });

//   // ── Desconexión ─────────────────────────────────────────────────────────
//   socket.on('disconnect', (reason) => {
//     if (devices.has(socket.id)) {
//       const dev = devices.get(socket.id);
//       console.log(`[-] Cliente desconectado: ${dev.nombre} — ${reason}`);
//       devices.delete(socket.id);
//       io.to('admins').emit('dispositivos-actualizados', Array.from(devices.values()));
//     } else {
//       console.log(`[-] Admin/desconocido desconectado: ${socket.id}`);
//     }
//   });
// });

// // ── Arranque del servidor ──────────────────────────────────────────────────
// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`\n✅  FinBlock Server corriendo en http://localhost:${PORT}`);
//   console.log(`🔌  Socket.io listo para conexiones\n`);
// });

/**
 * FinBlock v3 — Backend con Firebase Firestore
 * node server.js
 *
 * Dependencias:
 *   npm install express socket.io cors jsonwebtoken bcryptjs uuid firebase-admin
 */

// const express    = require('express');
// const http       = require('http');
// const { Server } = require('socket.io');
// const cors       = require('cors');
// const jwt        = require('jsonwebtoken');
// const bcrypt     = require('bcryptjs');
// const { v4: uuidv4 } = require('uuid');
// const admin      = require('firebase-admin');

// // ─── Firebase Admin Init ────────────────────────────────────────────────────
// // Descarga tu serviceAccountKey.json desde Firebase Console →
// // Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada
// const serviceAccount = require('./serviceAccountKey.json');

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// const db = admin.firestore();

// // ─── Express + Socket.io ────────────────────────────────────────────────────
// const app    = express();
// const server = http.createServer(app);
// const io     = new Server(server, {
//   cors: { origin: '*', methods: ['GET', 'POST'] },
// });

// app.use(cors());
// app.use(express.json());

// const JWT_SECRET = process.env.JWT_SECRET || 'finblock-firebase-2026';

// // ─── Conexiones Socket activas en memoria ───────────────────────────────────
// // socketId → { tipo, financieroId, clienteId }
// const conexiones = new Map();

// // clienteId → socketId activo (para mandar ordenes)
// const clienteSocket = new Map();

// // ─────────────────────────────────────────────────────────────────────────────
// // SEED: Crear financiero admin inicial si no existe
// // usuario: gabriel0730  contraseña: 12345678
// // ─────────────────────────────────────────────────────────────────────────────

// async function seedAdmin() {
//   const ref  = db.collection('financieros').doc('gabriel0730');
//   const snap = await ref.get();

//   if (!snap.exists) {
//     const hash = await bcrypt.hash('12345678', 10);
//     await ref.set({
//       id:       'gabriel0730',
//       nombre:   'Gabriel Admin',
//       email:    'gabriel@finblock.com',
//       username: 'gabriel0730',
//       password: hash,
//       creadoEn: admin.firestore.FieldValue.serverTimestamp(),
//     });
//     console.log('✅ Admin creado: gabriel0730 / 12345678');
//   } else {
//     console.log('✅ Admin ya existe: gabriel0730');
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // MIDDLEWARE JWT
// // ─────────────────────────────────────────────────────────────────────────────
// function verificarToken(req, res, next) {
//   const auth = req.headers.authorization;
//   if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Sin token' });
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

// // ── Login (usuario gabriel0730 / 12345678) ──────────────────────────────────
// app.post('/api/auth/login', async (req, res) => {
//   const { username, password } = req.body;

//   // Buscar por username
//   const snap = await db.collection('financieros')
//     .where('username', '==', username)
//     .limit(1)
//     .get();

//   if (snap.empty) return res.status(401).json({ error: 'Credenciales inválidas' });

//   const fin = snap.docs[0].data();
//   const ok  = await bcrypt.compare(password, fin.password);
//   if (!ok)  return res.status(401).json({ error: 'Credenciales inválidas' });

//   const token = jwt.sign(
//     { financieroId: fin.id, nombre: fin.nombre, username: fin.username },
//     JWT_SECRET,
//     { expiresIn: '8h' }
//   );
//   res.json({ token, financiero: { id: fin.id, nombre: fin.nombre, username: fin.username } });
// });


// // ══════════════════════════════════════════════════════════════
// // Agrega esta ruta a tu server.js DESPUÉS de la ruta de login
// // POST /api/auth/setup — crea el admin por primera vez
// // ══════════════════════════════════════════════════════════════

// app.post('/api/auth/setup', async (req, res) => {
//   const { username, password } = req.body;

//   if (!username || !password) {
//     return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
//   }

//   if (password.length < 8) {
//     return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
//   }

//   try {
//     // Verificar si ya existe un admin con ese username
//     const existing = await db.collection('financieros')
//       .where('username', '==', username.trim())
//       .limit(1)
//       .get();

//     if (!existing.empty) {
//       return res.status(409).json({ error: 'El usuario ya existe. Usa las credenciales que configuraste.' });
//     }

//     // Crear el admin
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

//     console.log(`✅ Admin creado via setup: ${username}`);
//     res.json({ ok: true, mensaje: `Admin '${username}' creado correctamente` });

//   } catch (err) {
//     console.error('Error en /api/auth/setup:', err);
//     res.status(500).json({ error: 'Error interno al crear el admin' });
//   }
// });

// // ── Obtener mis clientes ─────────────────────────────────────────────────────
// app.get('/api/mis-clientes', verificarToken, async (req, res) => {
//   const snap = await db.collection('clientes')
//     .where('financieroId', '==', req.financiero.financieroId)
//     .get();

//   const lista = snap.docs.map(d => {
//     const c = d.data();
//     return {
//       clienteId:   c.clienteId,
//       nombre:      c.nombre,
//       estado:      c.estado,
//       deviceToken: c.deviceToken,
//       conectado:   clienteSocket.has(c.clienteId),
//       creadoEn:    c.creadoEn,
//     };
//   });
//   res.json(lista);
// });

// // ── Registrar nuevo cliente ──────────────────────────────────────────────────
// // El financiero pone el nombre del cliente, recibe un PIN/token único
// // que debe ingresar en la app Android del cliente.
// app.post('/api/clientes', verificarToken, async (req, res) => {
//   const { nombre } = req.body;
//   if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

//   const clienteId  = `cli-${uuidv4().slice(0, 8)}`;
//   // PIN de 8 caracteres legible (sin 0/O/I/l para evitar confusión)
//   const deviceToken = generarPIN();

//   const data = {
//     clienteId,
//     nombre,
//     financieroId: req.financiero.financieroId,
//     deviceToken,
//     estado:  'activo',
//     creadoEn: admin.firestore.FieldValue.serverTimestamp(),
//   };

//   await db.collection('clientes').doc(clienteId).set(data);

//   res.json({
//     clienteId,
//     nombre,
//     deviceToken,
//     mensaje: `Instala FinBlock en el Android del cliente e ingresa este PIN: ${deviceToken}`,
//   });
// });

// // ── Eliminar cliente ─────────────────────────────────────────────────────────
// app.delete('/api/clientes/:id', verificarToken, async (req, res) => {
//   const snap = await db.collection('clientes').doc(req.params.id).get();
//   if (!snap.exists) return res.status(404).json({ error: 'No encontrado' });

//   const c = snap.data();
//   if (c.financieroId !== req.financiero.financieroId)
//     return res.status(403).json({ error: 'Sin permiso' });

//   await db.collection('clientes').doc(req.params.id).delete();
//   res.json({ ok: true });
// });

// // ── Bloquear via REST ────────────────────────────────────────────────────────
// app.post('/api/clientes/:id/bloquear', verificarToken, async (req, res) => {
//   const r = await accionCliente(req.params.id, req.financiero.financieroId, 'bloqueado');
//   if (r.error) return res.status(r.status).json({ error: r.error });
//   res.json({ ok: true });
// });

// // ── Desbloquear via REST ─────────────────────────────────────────────────────
// app.post('/api/clientes/:id/desbloquear', verificarToken, async (req, res) => {
//   const r = await accionCliente(req.params.id, req.financiero.financieroId, 'activo');
//   if (r.error) return res.status(r.status).json({ error: r.error });
//   res.json({ ok: true });
// });

// // ── Health ───────────────────────────────────────────────────────────────────
// app.get('/health', async (_, res) => {
//   const snap = await db.collection('clientes').count().get();
//   res.json({ ok: true, clientes: snap.data().count });
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // HELPERS
// // ─────────────────────────────────────────────────────────────────────────────
// function generarPIN() {
//   const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
//   let pin = '';
//   for (let i = 0; i < 8; i++) pin += chars[Math.floor(Math.random() * chars.length)];
//   return pin;
// }

// async function accionCliente(clienteId, financieroId, nuevoEstado) {
//   const ref  = db.collection('clientes').doc(clienteId);
//   const snap = await ref.get();
//   if (!snap.exists) return { error: 'No encontrado', status: 404 };

//   const c = snap.data();
//   if (c.financieroId !== financieroId) return { error: 'Sin permiso', status: 403 };

//   await ref.update({ estado: nuevoEstado });

//   const evento = nuevoEstado === 'bloqueado' ? 'orden-bloquear' : 'orden-desbloquear';
//   const socketId = clienteSocket.get(clienteId);
//   if (socketId) {
//     io.to(socketId).emit(evento, {
//       mensaje: nuevoEstado === 'bloqueado'
//         ? 'Dispositivo bloqueado por falta de pago.'
//         : 'Dispositivo desbloqueado.',
//       timestamp: new Date().toISOString(),
//     });
//   }

//   notificarAdmins(financieroId);
//   return { ok: true };
// }

// async function getMisClientes(financieroId) {
//   const snap = await db.collection('clientes')
//     .where('financieroId', '==', financieroId)
//     .get();

//   return snap.docs.map(d => {
//     const c = d.data();
//     return {
//       clienteId:  c.clienteId,
//       nombre:     c.nombre,
//       estado:     c.estado,
//       deviceToken: c.deviceToken,
//       conectado:  clienteSocket.has(c.clienteId),
//     };
//   });
// }

// async function notificarAdmins(financieroId) {
//   const lista = await getMisClientes(financieroId);
//   io.to(`admin-${financieroId}`).emit('dispositivos-actualizados', lista);
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // SOCKET.IO
// // ─────────────────────────────────────────────────────────────────────────────
// io.use(async (socket, next) => {
//   const { tipo, token } = socket.handshake.auth;

//   if (tipo === 'cliente') {
//     // El cliente se autentica con su deviceToken (PIN)
//     const snap = await db.collection('clientes')
//       .where('deviceToken', '==', token)
//       .limit(1)
//       .get();

//     if (snap.empty) return next(new Error('PIN inválido'));

//     const c = snap.docs[0].data();
//     socket.data.tipo        = 'cliente';
//     socket.data.clienteId   = c.clienteId;
//     socket.data.nombre      = c.nombre;
//     socket.data.financieroId = c.financieroId;
//     socket.data.estado      = c.estado;
//     return next();
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

//   next(new Error('Tipo desconocido'));
// });

// io.on('connection', async (socket) => {
//   const { tipo, financieroId, clienteId } = socket.data;

//   // ── CLIENTE ──────────────────────────────────────────────────────────────
//   if (tipo === 'cliente') {
//     clienteSocket.set(clienteId, socket.id);
//     socket.join(`cliente-${clienteId}`);
//     socket.join(`financiero-${financieroId}`);

//     console.log(`[CLIENTE] ${socket.data.nombre} conectado`);

//     // Si estaba bloqueado antes de reconectarse → re-enviar orden
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

//     // Enviar estado actual
//     const lista = await getMisClientes(financieroId);
//     socket.emit('dispositivos-actualizados', lista);

//     // Bloquear uno
//     socket.on('admin-bloquear', async ({ clienteId: targetId }) => {
//       const snap = await db.collection('clientes').doc(targetId).get();
//       if (!snap.exists) return;
//       const c = snap.data();

//       // SEGURIDAD: solo puede bloquear a SUS clientes
//       if (c.financieroId !== financieroId) {
//         socket.emit('error-accion', { mensaje: 'Sin permiso sobre este dispositivo' });
//         return;
//       }

//       await db.collection('clientes').doc(targetId).update({ estado: 'bloqueado' });

//       io.to(`cliente-${targetId}`).emit('orden-bloquear', {
//         mensaje: 'Dispositivo bloqueado por falta de pago.',
//         timestamp: new Date().toISOString(),
//       });

//       notificarAdmins(financieroId);
//       console.log(`[BLOQUEO] ${c.nombre} bloqueado por ${socket.data.nombre}`);
//     });

//     // Desbloquear uno
//     socket.on('admin-desbloquear', async ({ clienteId: targetId }) => {
//       const snap = await db.collection('clientes').doc(targetId).get();
//       if (!snap.exists) return;
//       const c = snap.data();

//       if (c.financieroId !== financieroId) {
//         socket.emit('error-accion', { mensaje: 'Sin permiso sobre este dispositivo' });
//         return;
//       }

//       await db.collection('clientes').doc(targetId).update({ estado: 'activo' });

//       io.to(`cliente-${targetId}`).emit('orden-desbloquear', {
//         mensaje: 'Dispositivo desbloqueado.',
//         timestamp: new Date().toISOString(),
//       });

//       notificarAdmins(financieroId);
//       console.log(`[DESBLOQUEO] ${c.nombre} desbloqueado por ${socket.data.nombre}`);
//     });

//     // Bloquear todos los del financiero
//     socket.on('admin-bloquear-todos', async () => {
//       const snap = await db.collection('clientes')
//         .where('financieroId', '==', financieroId)
//         .get();

//       const batch = db.batch();
//       snap.docs.forEach(d => batch.update(d.ref, { estado: 'bloqueado' }));
//       await batch.commit();

//       snap.docs.forEach(d => {
//         const c = d.data();
//         io.to(`cliente-${c.clienteId}`).emit('orden-bloquear', {
//           mensaje: 'Dispositivo bloqueado por falta de pago.',
//           timestamp: new Date().toISOString(),
//         });
//       });

//       notificarAdmins(financieroId);
//     });


//     app.post('/api/verificar-pin', async (req, res) => {
//   const { deviceToken } = req.body;
//   if (!deviceToken) return res.status(400).json({ error: 'PIN requerido' });
 
//   const snap = await db.collection('clientes')
//     .where('deviceToken', '==', deviceToken)
//     .limit(1)
//     .get();
 
//   if (snap.empty) return res.status(404).json({ error: 'PIN inválido' });
 
//   const c = snap.docs[0].data();
//   res.json({ ok: true, nombre: c.nombre });
// });

//     // Desbloquear todos
//     socket.on('admin-desbloquear-todos', async () => {
//       const snap = await db.collection('clientes')
//         .where('financieroId', '==', financieroId)
//         .get();

//       const batch = db.batch();
//       snap.docs.forEach(d => batch.update(d.ref, { estado: 'activo' }));
//       await batch.commit();

//       snap.docs.forEach(d => {
//         const c = d.data();
//         io.to(`cliente-${c.clienteId}`).emit('orden-desbloquear', {
//           mensaje: 'Dispositivo desbloqueado.',
//           timestamp: new Date().toISOString(),
//         });
//       });

//       notificarAdmins(financieroId);
//     });

//     socket.on('disconnect', () => {
//       console.log(`[ADMIN] ${socket.data.nombre} desconectado`);
//     });
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 3000;
// seedAdmin().then(() => {
//   server.listen(PORT, () => {
//     console.log(`\n🚀 FinBlock v3 (Firebase) corriendo en http://localhost:${PORT}\n`);
//     console.log('   Login: gabriel0730 / 12345678\n');
//   });
// });

/**
 * FinBlock v3 — Backend con Firebase Firestore
 * backend/server.js
 *
 * Correcciones:
 * - /api/verificar-pin movido FUERA del handler de socket (estaba dentro)
 * - seedAdmin solo crea si no existe (idempotente)
 * - Todos los endpoints REST correctamente definidos
 *
 * Instalación:
 *   npm install express socket.io cors jsonwebtoken bcryptjs uuid firebase-admin
 *
 * Requiere: ./serviceAccountKey.json (descarga desde Firebase Console)
 */

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const admin      = require('firebase-admin');

// ── Firebase Init ──────────────────────────────────────────────────────────
// ── DESPUÉS (esto) ────────────────────────────
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Producción (Render) — viene de variable de entorno
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log('✅ Firebase: usando variable de entorno');
} else {
  // Local — usa el archivo JSON
  serviceAccount = require('./serviceAccountKey.json');
  console.log('✅ Firebase: usando serviceAccountKey.json local');
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Express + Socket.io ────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'finblock-firebase-2026';

// clienteId → socketId activo
const clienteSocket = new Map();

// ── Seed admin inicial ─────────────────────────────────────────────────────
async function seedAdmin() {
  const ref  = db.collection('financieros').doc('gabriel0730');
  const snap = await ref.get();
  if (!snap.exists) {
    const hash = await bcrypt.hash('12345678', 10);
    await ref.set({
      id: 'gabriel0730', nombre: 'Gabriel Admin',
      email: 'gabriel@finblock.com', username: 'gabriel0730',
      password: hash, creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✅ Admin creado: gabriel0730 / 12345678');
  } else {
    console.log('✅ Admin ya existe: gabriel0730');
  }
}

// ── JWT Middleware ──────────────────────────────────────────────────────────
function verificarToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Sin token' });
  try {
    req.financiero = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API REST
// ─────────────────────────────────────────────────────────────────────────────

// ── Login ──────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const snap = await db.collection('financieros')
    .where('username', '==', username).limit(1).get();

  if (snap.empty) return res.status(401).json({ error: 'Credenciales inválidas' });
  const fin = snap.docs[0].data();
  const ok  = await bcrypt.compare(password, fin.password);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign(
    { financieroId: fin.id, nombre: fin.nombre, username: fin.username },
    JWT_SECRET, { expiresIn: '8h' }
  );
  res.json({ token, financiero: { id: fin.id, nombre: fin.nombre, username: fin.username } });
});

// ── Setup: crear admin por primera vez (POST /api/auth/setup) ─────────────
app.post('/api/auth/setup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)        return res.status(400).json({ error: 'Datos incompletos' });
  if (password.length < 8)           return res.status(400).json({ error: 'Contraseña muy corta' });

  const existing = await db.collection('financieros')
    .where('username', '==', username.trim()).limit(1).get();
  if (!existing.empty) return res.status(409).json({ error: 'Usuario ya existe' });

  const hash = await bcrypt.hash(password, 10);
  const id   = username.trim().toLowerCase().replace(/\s+/g, '_');
  await db.collection('financieros').doc(id).set({
    id, nombre: `Admin ${username}`, email: `${id}@finblock.com`,
    username: username.trim(), password: hash,
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.json({ ok: true, mensaje: `Admin '${username}' creado` });
});

// ── Verificar PIN del cliente (usado por la app antes de activar) ─────────
// IMPORTANTE: esta ruta va AQUÍ, fuera de cualquier otro handler
app.post('/api/verificar-pin', async (req, res) => {
  const { deviceToken } = req.body;
  if (!deviceToken) return res.status(400).json({ error: 'PIN requerido' });

  const snap = await db.collection('clientes')
    .where('deviceToken', '==', deviceToken).limit(1).get();

  if (snap.empty) return res.status(404).json({ error: 'PIN inválido' });

  const c = snap.docs[0].data();
  res.json({ ok: true, nombre: c.nombre, estado: c.estado });
});

// ── Mis clientes ───────────────────────────────────────────────────────────
app.get('/api/mis-clientes', verificarToken, async (req, res) => {
  const snap = await db.collection('clientes')
    .where('financieroId', '==', req.financiero.financieroId).get();

  const lista = snap.docs.map(d => {
    const c = d.data();
    return {
      clienteId:   c.clienteId,
      nombre:      c.nombre,
      estado:      c.estado,
      deviceToken: c.deviceToken,
      conectado:   clienteSocket.has(c.clienteId),
    };
  });
  res.json(lista);
});

// ── Registrar cliente ──────────────────────────────────────────────────────
app.post('/api/clientes', verificarToken, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

  const clienteId   = `cli-${uuidv4().slice(0, 8)}`;
  const deviceToken = generarPIN();

  await db.collection('clientes').doc(clienteId).set({
    clienteId, nombre,
    financieroId: req.financiero.financieroId,
    deviceToken, estado: 'activo',
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
  });

  res.json({ clienteId, nombre, deviceToken });
});

// ── Eliminar cliente ───────────────────────────────────────────────────────
app.delete('/api/clientes/:id', verificarToken, async (req, res) => {
  const snap = await db.collection('clientes').doc(req.params.id).get();
  if (!snap.exists) return res.status(404).json({ error: 'No encontrado' });
  if (snap.data().financieroId !== req.financiero.financieroId)
    return res.status(403).json({ error: 'Sin permiso' });

  await db.collection('clientes').doc(req.params.id).delete();
  res.json({ ok: true });
});

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', async (_, res) => {
  res.json({ ok: true, clientesActivos: clienteSocket.size });
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function generarPIN() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function getMisClientes(financieroId) {
  const snap = await db.collection('clientes')
    .where('financieroId', '==', financieroId).get();
  return snap.docs.map(d => {
    const c = d.data();
    return {
      clienteId:   c.clienteId,
      nombre:      c.nombre,
      estado:      c.estado,
      deviceToken: c.deviceToken,
      conectado:   clienteSocket.has(c.clienteId),
    };
  });
}

async function notificarAdmins(financieroId) {
  const lista = await getMisClientes(financieroId);
  io.to(`admin-${financieroId}`).emit('dispositivos-actualizados', lista);
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET.IO — autenticación
// ─────────────────────────────────────────────────────────────────────────────
io.use(async (socket, next) => {
  const { tipo, token } = socket.handshake.auth;

  if (tipo === 'cliente') {
    const snap = await db.collection('clientes')
      .where('deviceToken', '==', token).limit(1).get();
    if (snap.empty) return next(new Error('PIN inválido'));

    const c = snap.docs[0].data();
    socket.data.tipo         = 'cliente';
    socket.data.clienteId    = c.clienteId;
    socket.data.nombre       = c.nombre;
    socket.data.financieroId = c.financieroId;
    socket.data.estado       = c.estado;
    return next();
  }

  if (tipo === 'admin') {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.data.tipo         = 'admin';
      socket.data.financieroId = decoded.financieroId;
      socket.data.nombre       = decoded.nombre;
      return next();
    } catch {
      return next(new Error('JWT inválido'));
    }
  }

  next(new Error('Tipo desconocido'));
});

io.on('connection', async (socket) => {
  const { tipo, financieroId, clienteId } = socket.data;

  // ── CLIENTE ──────────────────────────────────────────────────────────────
  if (tipo === 'cliente') {
    clienteSocket.set(clienteId, socket.id);
    socket.join(`cliente-${clienteId}`);

    console.log(`[CLIENTE] ${socket.data.nombre} conectado`);

    // Si estaba bloqueado en Firebase → re-enviar orden al reconectar
    if (socket.data.estado === 'bloqueado') {
      socket.emit('orden-bloquear', {
        mensaje: 'Dispositivo bloqueado por falta de pago.',
        timestamp: new Date().toISOString(),
      });
    }

    notificarAdmins(financieroId);

    socket.on('disconnect', () => {
      clienteSocket.delete(clienteId);
      console.log(`[CLIENTE] ${socket.data.nombre} desconectado`);
      notificarAdmins(financieroId);
    });
  }

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  if (tipo === 'admin') {
    socket.join(`admin-${financieroId}`);
    console.log(`[ADMIN] ${socket.data.nombre} conectado`);

    const lista = await getMisClientes(financieroId);
    socket.emit('dispositivos-actualizados', lista);

    socket.on('admin-bloquear', async ({ clienteId: targetId }) => {
      const snap = await db.collection('clientes').doc(targetId).get();
      if (!snap.exists) return;
      const c = snap.data();
      if (c.financieroId !== financieroId) {
        socket.emit('error-accion', { mensaje: 'Sin permiso' }); return;
      }
      await db.collection('clientes').doc(targetId).update({ estado: 'bloqueado' });
      io.to(`cliente-${targetId}`).emit('orden-bloquear', {
        mensaje: 'Dispositivo bloqueado por falta de pago.',
        timestamp: new Date().toISOString(),
      });
      notificarAdmins(financieroId);
      console.log(`[BLOQUEO] ${c.nombre}`);
    });

    socket.on('admin-desbloquear', async ({ clienteId: targetId }) => {
      const snap = await db.collection('clientes').doc(targetId).get();
      if (!snap.exists) return;
      const c = snap.data();
      if (c.financieroId !== financieroId) {
        socket.emit('error-accion', { mensaje: 'Sin permiso' }); return;
      }
      await db.collection('clientes').doc(targetId).update({ estado: 'activo' });
      io.to(`cliente-${targetId}`).emit('orden-desbloquear', {
        mensaje: 'Dispositivo desbloqueado.',
        timestamp: new Date().toISOString(),
      });
      notificarAdmins(financieroId);
      console.log(`[DESBLOQUEO] ${c.nombre}`);
    });

    socket.on('admin-bloquear-todos', async () => {
      const snap = await db.collection('clientes')
        .where('financieroId', '==', financieroId).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.update(d.ref, { estado: 'bloqueado' }));
      await batch.commit();
      snap.docs.forEach(d => {
        io.to(`cliente-${d.data().clienteId}`).emit('orden-bloquear', {
          mensaje: 'Bloqueado por falta de pago.', timestamp: new Date().toISOString(),
        });
      });
      notificarAdmins(financieroId);
    });

    socket.on('admin-desbloquear-todos', async () => {
      const snap = await db.collection('clientes')
        .where('financieroId', '==', financieroId).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.update(d.ref, { estado: 'activo' }));
      await batch.commit();
      snap.docs.forEach(d => {
        io.to(`cliente-${d.data().clienteId}`).emit('orden-desbloquear', {
          mensaje: 'Dispositivo desbloqueado.', timestamp: new Date().toISOString(),
        });
      });
      notificarAdmins(financieroId);
    });

    socket.on('disconnect', () => {
      console.log(`[ADMIN] ${socket.data.nombre} desconectado`);
    });
  }
});

// ── Arranque ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
seedAdmin().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 FinBlock v3 corriendo en http://localhost:${PORT}`);
    console.log('   Login admin: gabriel0730 / 12345678\n');
  });
});
