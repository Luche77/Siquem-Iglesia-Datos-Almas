// ─── CONFIGURACIÓN FIREBASE ─────────────────────────────────────────────────
// ⚠️  REEMPLAZÁ estos valores con los de TU proyecto Firebase
// Instrucciones en INSTALACION.md

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAgT6Akoz09lgMg5iWZjDaQN81UfGbnxJs",
  authDomain: "siquem-iglesia-almas.firebaseapp.com",
  projectId: "siquem-iglesia-almas",
  storageBucket: "siquem-iglesia-almas.firebasestorage.app",
  messagingSenderId: "266482272364",
  appId: "1:266482272364:web:28089f6fd73e863362f049"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── ESTADO GLOBAL ───────────────────────────────────────────────────────────
let currentUser = null;
let visitasCache = [];
let encargadosCache = [];
let notifsCache = [];
let filtroMios = 'todos';
let filtroTodas = 'todas';
let modalVisitaId = null;

// ─── LOGIN ───────────────────────────────────────────────────────────────────
window.doLogin = async function() {
  const usuario = document.getElementById('login-user').value.trim().toLowerCase();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!usuario || !pass) { showError('Completá usuario y contraseña'); return; }

  try {
    // Admin por defecto — cambiá 'admin123' por tu contraseña segura
    if (usuario === 'admin' && pass === 'nuevatemporada1304') {
      currentUser = { id: 'admin', nombre: 'Administrador', rol: 'admin', usuario: 'admin' };
      sessionStorage.setItem('cv_user', JSON.stringify(currentUser));
      iniciarApp();
      return;
    }

    const encSnap = await getDocs(query(collection(db, 'encargados'), where('usuario', '==', usuario)));
    if (encSnap.empty) { showError('Usuario no encontrado'); return; }

    const encDoc = encSnap.docs[0];
    const enc = { id: encDoc.id, ...encDoc.data() };

    if (enc.pass !== pass) { showError('Contraseña incorrecta'); return; }

    currentUser = enc;
    sessionStorage.setItem('cv_user', JSON.stringify(currentUser));
    iniciarApp();
  } catch (e) {
    showError('Error de conexión. Verificá la configuración de Firebase.');
    console.error(e);
  }
};

function showError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

window.doLogout = function() {
  sessionStorage.removeItem('cv_user');
  currentUser = null;
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
};

// ─── INICIAR APP ─────────────────────────────────────────────────────────────
async function iniciarApp() {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');

  document.getElementById('header-user').textContent =
    `${currentUser.nombre} · ${currentUser.rol === 'admin' ? 'Administrador' : 'Encargado'}`;

  // Saludo según hora
  const h = new Date().getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('inicio-saludo').textContent = `${saludo}, ${currentUser.nombre.split(' ')[0]}`;

  // Mostrar/ocultar nav según rol
  const isAdmin = currentUser.rol === 'admin';
  document.getElementById('nav-nueva').style.display = isAdmin ? '' : 'none';
  document.getElementById('nav-todas').style.display = isAdmin ? '' : 'none';
  document.getElementById('nav-encargados').style.display = isAdmin ? '' : 'none';

  // Fecha de hoy en el form
  document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0];

  // Escuchar datos en tiempo real
  escucharVisitas();
  escucharEncargados();
  escucharNotificaciones();

  showPage('inicio');
}

// ─── LISTENERS FIREBASE ──────────────────────────────────────────────────────
function escucharVisitas() {
  onSnapshot(collection(db, 'visitas'), snap => {
    visitasCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderInicio();
    renderMisAsignados();
    renderTodas();
  });
}

function escucharEncargados() {
  onSnapshot(collection(db, 'encargados'), snap => {
    encargadosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEncargados();
  });
}

function escucharNotificaciones() {
  if (!currentUser) return;
  const q = query(collection(db, 'notificaciones'), where('paraId', '==', currentUser.id));
  onSnapshot(q, snap => {
    notifsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const noLeidas = notifsCache.filter(n => !n.leida).length;
    document.getElementById('notif-dot').style.display = noLeidas > 0 ? 'block' : 'none';
    renderNotificaciones();
  });
}

// ─── HELPERS FECHA ───────────────────────────────────────────────────────────
function hoy() { const d = new Date(); d.setHours(0,0,0,0); return d; }

function diasDesde(fechaStr) {
  if (!fechaStr) return 999;
  const f = new Date(fechaStr); f.setHours(0,0,0,0);
  return Math.floor((hoy() - f) / 86400000);
}

function diasSinContacto(v) {
  if (v.historial && v.historial.length > 0) {
    const ultimo = v.historial[v.historial.length - 1].fecha;
    return diasDesde(ultimo);
  }
  return diasDesde(v.fecha);
}

function diasBadge(dias) {
  if (dias < 14) return `<span class="dias-badge dias-ok">${dias}d</span>`;
  if (dias < 21) return `<span class="dias-badge dias-warn">${dias}d</span>`;
  return `<span class="dias-badge dias-late">${dias}d</span>`;
}

function formatFecha(str) {
  if (!str) return '-';
  const [y,m,d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function initials(nombre) {
  return (nombre || '??').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
}

function catLabel(cat) {
  return { 'mujer-joven':'Mujeres jóvenes','mujer-adulta':'Mujeres adultas','varon-joven':'Varones jóvenes','varon-adulto':'Varones adultos' }[cat] || cat;
}

function catClass(cat) {
  return { 'mujer-joven':'cat-mj','mujer-adulta':'cat-ma','varon-joven':'cat-vj','varon-adulto':'cat-va' }[cat] || '';
}

function catDeVisita(genero, edad) {
  const e = parseInt(edad) || 0;
  if (genero === 'F') return e <= 35 ? 'mujer-joven' : 'mujer-adulta';
  return e <= 35 ? 'varon-joven' : 'varon-adulto';
}

function limpiarTel(tel) {
  return (tel || '').replace(/\D/g, '');
}

// ─── RENDER INICIO ───────────────────────────────────────────────────────────
function renderInicio() {
  const v = currentUser.rol === 'admin' ? visitasCache : visitasCache.filter(x => x.encargadoId === currentUser.id);
  const urgentes = v.filter(x => diasSinContacto(x) >= 14);
  const proximos = v.filter(x => { const d = diasSinContacto(x); return d >= 7 && d < 14; });
  const ok = v.filter(x => diasSinContacto(x) < 7);

  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-n">${v.length}</div><div class="stat-l">Total</div></div>
    <div class="stat-card"><div class="stat-n" style="color:var(--danger)">${urgentes.length}</div><div class="stat-l">Urgentes</div></div>
    <div class="stat-card"><div class="stat-n" style="color:var(--success)">${ok.length}</div><div class="stat-l">Al día</div></div>
  `;

  document.getElementById('cnt-urgentes').textContent = urgentes.length;
  document.getElementById('cnt-proximos').textContent = proximos.length;

  document.getElementById('list-urgentes').innerHTML = urgentes.length
    ? urgentes.map(x => cardVisita(x)).join('')
    : `<div class="empty-state">Sin pendientes urgentes 🎉</div>`;

  document.getElementById('list-proximos').innerHTML = proximos.length
    ? proximos.map(x => cardVisita(x)).join('')
    : `<div class="empty-state" style="padding:16px">Ninguna en este rango</div>`;
}

// ─── CARD VISITA ─────────────────────────────────────────────────────────────
function cardVisita(x) {
  const dias = diasSinContacto(x);
  const enc = encargadosCache.find(e => e.id === x.encargadoId);
  return `<div class="visita-card" onclick="abrirModal('${x.id}')">
    <div class="visita-avatar ${x.genero === 'F' ? 'av-f' : 'av-m'}">${initials(x.nombre)}</div>
    <div class="visita-body">
      <div class="visita-nombre">${x.nombre}</div>
      <div class="visita-meta">${x.genero === 'F' ? 'Mujer' : 'Varón'}, ${x.edad} años · Visita: ${formatFecha(x.fecha)}</div>
      ${enc ? `<div class="visita-enc">Encargado: ${enc.nombre}</div>` : ''}
    </div>
    <div class="visita-right">${diasBadge(dias)}<div class="dias-label">${x.historial?.length ? 'últ. contacto' : 'desde visita'}</div></div>
  </div>`;
}

// ─── MIS ASIGNADOS ───────────────────────────────────────────────────────────
function renderMisAsignados() {
  let v = visitasCache.filter(x => x.encargadoId === currentUser.id);
  if (filtroMios === 'urgente') v = v.filter(x => diasSinContacto(x) >= 14);
  if (filtroMios === 'ok') v = v.filter(x => diasSinContacto(x) < 14);
  const el = document.getElementById('list-mis-asignados');
  el.innerHTML = v.length
    ? v.map(x => cardVisita(x)).join('')
    : `<div class="empty-state"><svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>No tenés asignados aún</div>`;
}

window.filtrarMios = function(f, btn) {
  filtroMios = f;
  document.querySelectorAll('#page-mis-asignados .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMisAsignados();
};

// ─── TODAS ───────────────────────────────────────────────────────────────────
function renderTodas() {
  let v = [...visitasCache];
  if (filtroTodas === 'urgentes') v = v.filter(x => diasSinContacto(x) >= 14);
  if (filtroTodas === 'sin-asignar') v = v.filter(x => !x.encargadoId);
  const el = document.getElementById('list-todas');
  el.innerHTML = v.length
    ? v.map(x => cardVisita(x)).join('')
    : `<div class="empty-state">Sin visitas registradas aún</div>`;
}

window.filtrarTodas = function(f, btn) {
  filtroTodas = f;
  document.querySelectorAll('#page-todas .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTodas();
};

// ─── ENCARGADOS ──────────────────────────────────────────────────────────────
function renderEncargados() {
  const el = document.getElementById('list-encargados');
  if (!encargadosCache.length) { el.innerHTML = '<div class="empty-state">Sin encargados aún</div>'; return; }
  el.innerHTML = encargadosCache.map(e => {
    const asignadas = visitasCache.filter(v => v.encargadoId === e.id).length;
    return `<div class="enc-card">
      <div class="visita-avatar ${e.cat?.startsWith('mujer') ? 'av-f' : 'av-m'}">${initials(e.nombre)}</div>
      <div class="enc-info">
        <div class="enc-nombre">${e.nombre}</div>
        <div class="enc-meta">@${e.usuario} · ${e.tel || '-'}</div>
        <span class="cat-label ${catClass(e.cat)}">${catLabel(e.cat)}</span>
        <span class="enc-badge ${e.rol === 'admin' ? 'rol-admin' : 'rol-enc'}" style="margin-left:6px">${e.rol === 'admin' ? 'Admin' : 'Encargado'}</span>
      </div>
      <div class="enc-stats"><div class="enc-cnt">${asignadas}</div><div class="enc-cnt-l">asignadas</div></div>
    </div>`;
  }).join('');
}

// ─── ASIGNACIÓN AUTOMÁTICA ───────────────────────────────────────────────────
function asignarEncargado(genero, edad) {
  const cat = catDeVisita(genero, edad);
  const candidatos = encargadosCache.filter(e => e.cat === cat && e.rol !== 'admin');
  if (!candidatos.length) return null;

  const conConteo = candidatos.map(e => ({
    ...e,
    count: visitasCache.filter(v => v.encargadoId === e.id).length
  }));
  conConteo.sort((a, b) => a.count - b.count);
  return conConteo[0];
}

// Vista previa de asignación al cambiar género/edad
function actualizarPreview() {
  const genero = document.getElementById('f-genero').value;
  const edad = document.getElementById('f-edad').value;
  const preview = document.getElementById('asignacion-preview');
  if (genero && edad) {
    const enc = asignarEncargado(genero, edad);
    preview.style.display = 'block';
    preview.innerHTML = enc
      ? `✦ Se asignará a <strong>${enc.nombre}</strong> (${catLabel(enc.cat)})`
      : `⚠ No hay encargados disponibles para esta categoría`;
  } else {
    preview.style.display = 'none';
  }
}

document.getElementById('f-genero')?.addEventListener('change', actualizarPreview);
document.getElementById('f-edad')?.addEventListener('input', actualizarPreview);

// ─── GUARDAR VISITA ──────────────────────────────────────────────────────────
window.guardarVisita = async function() {
  const nombre = document.getElementById('f-nombre').value.trim();
  const edad = document.getElementById('f-edad').value;
  const genero = document.getElementById('f-genero').value;
  const tel = document.getElementById('f-tel').value.trim();
  const fecha = document.getElementById('f-fecha').value;
  const notas = document.getElementById('f-notas').value.trim();

  if (!nombre || !edad || !genero || !tel || !fecha) { showToast('Completá todos los campos obligatorios'); return; }

  const enc = asignarEncargado(genero, edad);

  const visita = {
    nombre, edad: parseInt(edad), genero, tel, fecha, notas,
    encargadoId: enc ? enc.id : null,
    encargadoNombre: enc ? enc.nombre : null,
    historial: [],
    creadoPor: currentUser.id,
    creadoEn: serverTimestamp()
  };

  try {
    const docRef = await addDoc(collection(db, 'visitas'), visita);

    // Crear notificación para el encargado
    if (enc) {
      await addDoc(collection(db, 'notificaciones'), {
        paraId: enc.id,
        paraNombre: enc.nombre,
        tipo: 'nueva-asignacion',
        visitaId: docRef.id,
        visitaNombre: nombre,
        visitaTel: tel,
        visitaEdad: parseInt(edad),
        visitaGenero: genero,
        visitaFecha: fecha,
        leida: false,
        creadoEn: serverTimestamp()
      });
    }

    // Limpiar form
    ['f-nombre','f-edad','f-tel','f-notas'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('f-genero').value = '';
    document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('asignacion-preview').style.display = 'none';

    showToast(enc ? `Registrado y asignado a ${enc.nombre}` : 'Registrado sin encargado disponible');
    showPage('inicio');
  } catch(e) {
    showToast('Error al guardar. Revisá la conexión.');
    console.error(e);
  }
};

// ─── GUARDAR ENCARGADO ───────────────────────────────────────────────────────
window.guardarEncargado = async function() {
  const nombre = document.getElementById('e-nombre').value.trim();
  const usuario = document.getElementById('e-usuario').value.trim().toLowerCase();
  const pass = document.getElementById('e-pass').value.trim();
  const tel = document.getElementById('e-tel').value.trim();
  const cat = document.getElementById('e-cat').value;
  const rol = document.getElementById('e-rol').value;

  if (!nombre || !usuario || !pass) { showToast('Completá nombre, usuario y contraseña'); return; }

  try {
    await addDoc(collection(db, 'encargados'), { nombre, usuario, pass, tel, cat, rol });
    ['e-nombre','e-usuario','e-pass','e-tel'].forEach(id => document.getElementById(id).value = '');
    showToast(`${nombre} agregado al equipo`);
  } catch(e) {
    showToast('Error al guardar'); console.error(e);
  }
};

// ─── MODAL DETALLE ───────────────────────────────────────────────────────────
window.abrirModal = async function(id) {
  const v = visitasCache.find(x => x.id === id);
  if (!v) return;
  modalVisitaId = id;

  const enc = encargadosCache.find(e => e.id === v.encargadoId);
  const dias = diasSinContacto(v);
  const telLimpio = limpiarTel(v.tel);

  const histHTML = (v.historial || []).length
    ? [...v.historial].reverse().map(h => `
      <div class="historial-item">
        <div class="hist-head">
          <span class="hist-fecha">${formatFecha(h.fecha)}</span>
          <span class="hist-medio medio-${h.medio}">${h.medio}</span>
        </div>
        ${h.obs ? `<div class="hist-obs">${h.obs}</div>` : ''}
      </div>`).join('')
    : `<div style="font-size:13px;color:var(--text3);padding:8px 0">Sin contactos registrados aún</div>`;

  // Botón eliminar — solo visible para admin
  const btnEliminar = currentUser.rol === 'admin' ? `
    <button onclick="eliminarVisita('${v.id}')" style="
      width:100%;
      margin-top:12px;
      padding:11px 16px;
      background:transparent;
      color:#e05555;
      border:1.5px solid #e05555;
      border-radius:10px;
      font-size:14px;
      font-weight:500;
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:7px;
    ">
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14H6L5 6"/>
        <path d="M10 11v6"/>
        <path d="M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>
      Eliminar visita
    </button>` : '';

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-inner">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div class="visita-avatar ${v.genero==='F'?'av-f':'av-m'}" style="width:52px;height:52px;font-size:16px">${initials(v.nombre)}</div>
        <div>
          <div class="modal-name">${v.nombre}</div>
          <div class="modal-sub">${v.genero==='F'?'Mujer':'Varón'}, ${v.edad} años · ${diasBadge(dias)}</div>
        </div>
      </div>
      <div class="info-row"><span class="info-label">Teléfono</span><span class="info-val"><a href="tel:${v.tel}">${v.tel}</a></span></div>
      <div class="info-row"><span class="info-label">Visita</span><span class="info-val">${formatFecha(v.fecha)}</span></div>
      <div class="info-row"><span class="info-label">Encargado</span><span class="info-val">${enc ? enc.nombre : 'Sin asignar'}</span></div>
      ${v.notas ? `<div class="info-row"><span class="info-label">Notas</span><span class="info-val">${v.notas}</span></div>` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn-whatsapp" onclick="window.open('https://wa.me/54${telLimpio}','_blank')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        WhatsApp
      </button>
      <a href="tel:${v.tel}" class="btn-primary" style="text-decoration:none;flex:1;margin-top:0">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/></svg>
        Llamar
      </a>
    </div>
    ${btnEliminar}

    <div class="seguimiento-section">
      <div class="seguimiento-title">Historial de contactos</div>
      ${histHTML}
      <div class="nuevo-seg">
        <div class="nuevo-seg-title">Registrar nuevo contacto</div>
        <div class="seg-row">
          <div class="field" style="margin-bottom:0">
            <label>Fecha</label>
            <input id="seg-fecha" type="date" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="field" style="margin-bottom:0">
            <label>Medio</label>
            <select id="seg-medio">
              <option value="whatsapp">WhatsApp</option>
              <option value="llamada">Llamada</option>
              <option value="visita">Visita personal</option>
            </select>
          </div>
        </div>
        <div class="field" style="margin-top:10px;margin-bottom:0">
          <label>Observaciones</label>
          <textarea id="seg-obs" placeholder="Ej: Contestó, quedamos en invitarla el próximo domingo..." rows="3"></textarea>
        </div>
        <button class="btn-primary" style="margin-top:10px" onclick="guardarSeguimiento()">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Guardar contacto
        </button>
      </div>
    </div>
  `;

  document.getElementById('modal-bg').classList.add('open');
};

window.cerrarModal = function(e) {
  if (!e || e.target === document.getElementById('modal-bg'))
    document.getElementById('modal-bg').classList.remove('open');
};

// ─── ELIMINAR VISITA (solo admin) ────────────────────────────────────────────
window.eliminarVisita = async function(id) {
  if (!confirm('¿Seguro que querés eliminar esta visita?\nEsta acción no se puede deshacer.')) return;
  try {
    await deleteDoc(doc(db, 'visitas', id));
    document.getElementById('modal-bg').classList.remove('open');
    showToast('Visita eliminada correctamente');
  } catch(e) {
    showToast('Error al eliminar. Revisá la conexión.');
    console.error(e);
  }
};

// ─── GUARDAR SEGUIMIENTO ─────────────────────────────────────────────────────
window.guardarSeguimiento = async function() {
  if (!modalVisitaId) return;
  const fecha = document.getElementById('seg-fecha').value;
  const medio = document.getElementById('seg-medio').value;
  const obs = document.getElementById('seg-obs').value.trim();
  if (!fecha) { showToast('Seleccioná la fecha'); return; }

  const v = visitasCache.find(x => x.id === modalVisitaId);
  if (!v) return;

  const historial = [...(v.historial || []), { fecha, medio, obs, registradoPor: currentUser.nombre }];

  try {
    await updateDoc(doc(db, 'visitas', modalVisitaId), { historial });
    document.getElementById('modal-bg').classList.remove('open');
    showToast('Contacto registrado');
  } catch(e) {
    showToast('Error al guardar'); console.error(e);
  }
};

// ─── NOTIFICACIONES ──────────────────────────────────────────────────────────
function renderNotificaciones() {
  const el = document.getElementById('list-notificaciones');
  if (!notifsCache.length) {
    el.innerHTML = '<div class="empty-state">Sin notificaciones</div>';
    return;
  }

  el.innerHTML = [...notifsCache].reverse().map(n => {
    const telLimpio = limpiarTel(n.visitaTel || '');
    const msg = encodeURIComponent(
      `Hola ${n.visitaNombre}! Te saluda ${currentUser.nombre} de la iglesia. ` +
      `Fue un gusto tenerte el ${formatFecha(n.visitaFecha)}. ¿Cómo estás? Queremos mantenernos en contacto contigo. ¡Bendiciones!`
    );

    return `<div class="notif-item ${n.leida ? '' : 'notif-new'}" onclick="marcarNotifLeida('${n.id}')">
      <div class="notif-head">
        <span class="notif-titulo">Nueva asignación: ${n.visitaNombre}</span>
        <span class="notif-fecha">${n.visitaFecha ? formatFecha(n.visitaFecha) : ''}</span>
      </div>
      <div class="notif-body">
        ${n.visitaGenero === 'F' ? 'Mujer' : 'Varón'}, ${n.visitaEdad} años · ${n.visitaTel || ''}
      </div>
      <button class="notif-wa-btn" onclick="event.stopPropagation();window.open('https://wa.me/54${telLimpio}?text=${msg}','_blank')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Enviar WhatsApp de bienvenida
      </button>
    </div>`;
  }).join('');
}

window.marcarNotifLeida = async function(id) {
  try { await updateDoc(doc(db, 'notificaciones', id), { leida: true }); }
  catch(e) { console.error(e); }
};

// ─── NAVEGACIÓN ──────────────────────────────────────────────────────────────
window.showPage = function(p) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));

  const pageEl = document.getElementById('page-' + p);
  if (pageEl) pageEl.classList.add('active');

  const navBtn = document.querySelector(`[data-page="${p}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (p === 'inicio') renderInicio();
  if (p === 'mis-asignados') renderMisAsignados();
  if (p === 'todas') renderTodas();
  if (p === 'encargados') renderEncargados();
  if (p === 'notificaciones') {
    renderNotificaciones();
    notifsCache.filter(n => !n.leida).forEach(n => marcarNotifLeida(n.id));
  }
};

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── AUTO-LOGIN ──────────────────────────────────────────────────────────────
const savedUser = sessionStorage.getItem('cv_user');
if (savedUser) {
  currentUser = JSON.parse(savedUser);
  iniciarApp();
}
