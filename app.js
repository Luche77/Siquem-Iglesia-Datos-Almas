import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ─── SUPABASE CONFIG ────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://xpzwqeeudodykmtueimu.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwendxZWV1ZG9keWttdHVlaW11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMDUzNjEsImV4cCI6MjA5Mjc4MTM2MX0.V3I5q59u7GxQgjSUT11AmsdHErMlEgrx1QFHHBwsDMk'
const sb = createClient(SUPABASE_URL, SUPABASE_ANON)

// ─── ESTADO ─────────────────────────────────────────────────────────────────
let currentUser = null
let visitas = []
let encargados = []
let notifs = []
let filtroMios = 'todos'
let filtroTodas = 'todas'
let modalId = null

// ─── LOGIN ───────────────────────────────────────────────────────────────────
window.doLogin = async function () {
  const usuario = document.getElementById('login-user').value.trim().toLowerCase()
  const pass = document.getElementById('login-pass').value
  const errEl = document.getElementById('login-error')
  const btn = document.getElementById('btn-login')
  errEl.style.display = 'none'
  if (!usuario || !pass) { showError('Completá usuario y contraseña'); return }

  btn.disabled = true
  btn.textContent = 'Ingresando...'

  try {
    // Admin por defecto hardcodeado
    if (usuario === 'admin' && pass === 'admin123') {
      currentUser = { id: 'admin-local', nombre: 'Administrador', rol: 'admin', usuario: 'admin' }
      sessionStorage.setItem('siquem_user', JSON.stringify(currentUser))
      await iniciarApp()
      return
    }

    const { data, error } = await sb
      .from('encargados')
      .select('*')
      .eq('usuario', usuario)
      .single()

    if (error || !data) { showError('Usuario no encontrado'); btn.disabled = false; btn.textContent = 'Ingresar'; return }
    if (data.pass !== pass) { showError('Contraseña incorrecta'); btn.disabled = false; btn.textContent = 'Ingresar'; return }

    currentUser = data
    sessionStorage.setItem('siquem_user', JSON.stringify(currentUser))
    await iniciarApp()
  } catch (e) {
    showError('Error de conexión. Verificá el internet.')
    console.error(e)
    btn.disabled = false
    btn.textContent = 'Ingresar'
  }
}

function showError(msg) {
  const el = document.getElementById('login-error')
  el.textContent = msg; el.style.display = 'block'
  document.getElementById('btn-login').disabled = false
  document.getElementById('btn-login').textContent = 'Ingresar'
}

window.doLogout = function () {
  sessionStorage.removeItem('siquem_user')
  currentUser = null
  document.getElementById('screen-app').classList.remove('active')
  document.getElementById('screen-login').classList.add('active')
  document.getElementById('login-user').value = ''
  document.getElementById('login-pass').value = ''
}

// ─── INICIAR APP ─────────────────────────────────────────────────────────────
async function iniciarApp() {
  document.getElementById('screen-login').classList.remove('active')
  document.getElementById('screen-app').classList.add('active')

  const isAdmin = currentUser.rol === 'admin'
  document.getElementById('header-user').textContent = `${currentUser.nombre} · ${isAdmin ? 'Admin' : 'Encargado'}`
  document.getElementById('nav-nueva').style.display = isAdmin ? '' : 'none'
  document.getElementById('nav-todas').style.display = isAdmin ? '' : 'none'
  document.getElementById('nav-equipo').style.display = isAdmin ? '' : 'none'

  const h = new Date().getHours()
  document.getElementById('saludo-text').textContent =
    `${h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${currentUser.nombre.split(' ')[0]}`

  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const hoy = new Date()
  document.getElementById('fecha-hoy').textContent = `${dias[hoy.getDay()]} ${hoy.getDate()} de ${meses[hoy.getMonth()]}`
  document.getElementById('f-fecha').value = hoy.toISOString().split('T')[0]

  await Promise.all([cargarVisitas(), cargarEncargados(), cargarNotifs()])
  showPage('inicio')
  suscribirseRealtime()
}

// ─── SUPABASE QUERIES ────────────────────────────────────────────────────────
async function cargarVisitas() {
  const { data } = await sb.from('visitas').select('*').order('created_at', { ascending: false })
  visitas = data || []
}

async function cargarEncargados() {
  const { data } = await sb.from('encargados').select('*').order('nombre')
  encargados = data || []
}

async function cargarNotifs() {
  if (!currentUser) return
  const { data } = await sb.from('notificaciones').select('*')
    .eq('para_id', currentUser.id).order('created_at', { ascending: false })
  notifs = data || []
  const noLeidas = notifs.filter(n => !n.leida).length
  document.getElementById('notif-dot').style.display = noLeidas > 0 ? 'block' : 'none'
}

function suscribirseRealtime() {
  sb.channel('visitas-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'visitas' }, async () => {
      await cargarVisitas(); renderPaginaActiva()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'encargados' }, async () => {
      await cargarEncargados(); renderPaginaActiva()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, async () => {
      await cargarNotifs(); renderNotifs()
    })
    .subscribe()
}

function renderPaginaActiva() {
  const activa = document.querySelector('.page.active')?.id?.replace('page-', '')
  if (activa) renderPagina(activa)
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function hoyDate() { const d = new Date(); d.setHours(0,0,0,0); return d }

function diasDesde(str) {
  if (!str) return 999
  const f = new Date(str); f.setHours(0,0,0,0)
  return Math.floor((hoyDate() - f) / 86400000)
}

function diasSinContacto(v) {
  if (v.historial?.length) return diasDesde(v.historial[v.historial.length - 1].fecha)
  return diasDesde(v.fecha)
}

function dBadge(dias) {
  if (dias < 14) return `<span class="d-badge d-ok">${dias}d</span>`
  if (dias < 21) return `<span class="d-badge d-warn">${dias}d</span>`
  return `<span class="d-badge d-late">${dias}d</span>`
}

function fmt(str) {
  if (!str) return '-'
  const [y,m,d] = str.split('-'); return `${d}/${m}/${y}`
}

function initials(n) { return (n||'??').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() }

function catLabel(c) {
  return {'mujer-joven':'Mujeres jóvenes','mujer-adulta':'Mujeres adultas','varon-joven':'Varones jóvenes','varon-adulto':'Varones adultos'}[c]||c
}

function catClass(c) {
  return {'mujer-joven':'b-mj','mujer-adulta':'b-ma','varon-joven':'b-vj','varon-adulto':'b-va'}[c]||''
}

function catDeVisita(genero, edad) {
  const e = parseInt(edad)||0
  if (genero==='F') return e<=35?'mujer-joven':'mujer-adulta'
  return e<=35?'varon-joven':'varon-adulto'
}

function limTel(t) { return (t||'').replace(/\D/g,'') }

function asignarEncargado(genero, edad) {
  const cat = catDeVisita(genero, edad)
  const cands = encargados.filter(e => e.cat === cat && e.rol !== 'admin')
  if (!cands.length) return null
  const conCnt = cands.map(e => ({ ...e, cnt: visitas.filter(v => v.encargado_id === e.id).length }))
  conCnt.sort((a,b) => a.cnt - b.cnt)
  return conCnt[0]
}

// ─── CARD VISITA ─────────────────────────────────────────────────────────────
function vCard(v) {
  const dias = diasSinContacto(v)
  const enc = encargados.find(e => e.id === v.encargado_id)
  return `<div class="v-card" onclick="abrirModal('${v.id}')">
    <div class="v-av ${v.genero==='F'?'av-f':'av-m'}">${initials(v.nombre)}</div>
    <div class="v-body">
      <div class="v-nombre">${v.nombre}</div>
      <div class="v-meta">${v.genero==='F'?'Mujer':'Varón'}, ${v.edad} años · ${fmt(v.fecha)}</div>
      ${enc?`<div class="v-enc">${enc.nombre}</div>`:''}
    </div>
    <div class="v-right">${dBadge(dias)}<div class="d-label">${v.historial?.length?'últ. contacto':'desde visita'}</div></div>
  </div>`
}

// ─── RENDER INICIO ───────────────────────────────────────────────────────────
function renderInicio() {
  const base = currentUser.rol==='admin' ? visitas : visitas.filter(v=>v.encargado_id===currentUser.id)
  const urg = base.filter(v=>diasSinContacto(v)>=14)
  const prox = base.filter(v=>{const d=diasSinContacto(v);return d>=7&&d<14})
  const ok = base.filter(v=>diasSinContacto(v)<7)

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-n">${base.length}</div><div class="stat-l">Total</div></div>
    <div class="stat-card"><div class="stat-n" style="color:var(--danger)">${urg.length}</div><div class="stat-l">Urgentes</div></div>
    <div class="stat-card"><div class="stat-n" style="color:var(--ok)">${ok.length}</div><div class="stat-l">Al día</div></div>`

  document.getElementById('cnt-urg').textContent = urg.length
  document.getElementById('cnt-prox').textContent = prox.length
  document.getElementById('list-urg').innerHTML = urg.length ? urg.map(vCard).join('') : '<div class="empty">Sin urgentes 🎉</div>'
  document.getElementById('list-prox').innerHTML = prox.length ? prox.map(vCard).join('') : '<div class="empty" style="padding:12px">Ninguna en este rango</div>'
}

// ─── MIS ASIGNADOS ───────────────────────────────────────────────────────────
function renderMisAsignados() {
  let v = visitas.filter(x=>x.encargado_id===currentUser.id)
  if (filtroMios==='urgente') v=v.filter(x=>diasSinContacto(x)>=14)
  if (filtroMios==='ok') v=v.filter(x=>diasSinContacto(x)<14)
  document.getElementById('list-mios').innerHTML = v.length ? v.map(vCard).join('') : '<div class="empty">No tenés asignados aún</div>'
}

window.setFiltroMios = function(f, btn) {
  filtroMios = f
  document.querySelectorAll('#page-mis-asignados .f-btn').forEach(b=>b.classList.remove('active'))
  btn.classList.add('active'); renderMisAsignados()
}

// ─── TODAS ───────────────────────────────────────────────────────────────────
function renderTodas() {
  let v = [...visitas]
  if (filtroTodas==='urgentes') v=v.filter(x=>diasSinContacto(x)>=14)
  if (filtroTodas==='sin-asignar') v=v.filter(x=>!x.encargado_id)
  document.getElementById('list-todas').innerHTML = v.length ? v.map(vCard).join('') : '<div class="empty">Sin visitas aún</div>'
}

window.setFiltroTodas = function(f, btn) {
  filtroTodas = f
  document.querySelectorAll('#page-todas .f-btn').forEach(b=>b.classList.remove('active'))
  btn.classList.add('active'); renderTodas()
}

// ─── EQUIPO ──────────────────────────────────────────────────────────────────
function renderEquipo() {
  const el = document.getElementById('list-equipo')
  if (!encargados.length) { el.innerHTML = '<div class="empty">Sin encargados aún</div>'; return }
  el.innerHTML = encargados.map(e => {
    const total = visitas.filter(v=>v.encargado_id===e.id).length
    return `<div class="enc-card">
      <div class="v-av ${e.cat?.startsWith('mujer')?'av-f':'av-m'}">${initials(e.nombre)}</div>
      <div class="enc-info">
        <div class="enc-nombre">${e.nombre}</div>
        <div class="enc-meta">@${e.usuario} · ${e.tel||'-'}</div>
        <div class="enc-badges">
          <span class="badge ${e.rol==='admin'?'b-admin':'b-enc'}">${e.rol==='admin'?'Admin':'Encargado'}</span>
          <span class="badge ${catClass(e.cat)}">${catLabel(e.cat)}</span>
        </div>
      </div>
      <div class="enc-cnt"><div class="enc-cnt-n">${total}</div><div class="enc-cnt-l">asignadas</div></div>
    </div>`
  }).join('')
}

// ─── GUARDAR VISITA ──────────────────────────────────────────────────────────
window.guardarVisita = async function () {
  const nombre = document.getElementById('f-nombre').value.trim()
  const edad = document.getElementById('f-edad').value
  const genero = document.getElementById('f-genero').value
  const tel = document.getElementById('f-tel').value.trim()
  const fecha = document.getElementById('f-fecha').value
  const notas = document.getElementById('f-notas').value.trim()
  if (!nombre||!edad||!genero||!tel||!fecha) { toast('Completá todos los campos obligatorios'); return }

  const enc = asignarEncargado(genero, edad)
  const payload = { nombre, edad:parseInt(edad), genero, tel, fecha, notas, historial:[], encargado_id: enc?.id||null, encargado_nombre: enc?.nombre||null, creado_por: currentUser.id }

  const { data, error } = await sb.from('visitas').insert(payload).select().single()
  if (error) { toast('Error al guardar: '+error.message); console.error(error); return }

  // Notificación para el encargado
  if (enc) {
    await sb.from('notificaciones').insert({
      para_id: enc.id, para_nombre: enc.nombre, tipo: 'nueva-asignacion',
      visita_id: data.id, visita_nombre: nombre, visita_tel: tel,
      visita_edad: parseInt(edad), visita_genero: genero, visita_fecha: fecha, leida: false
    })
  }

  ;['f-nombre','f-edad','f-tel','f-notas'].forEach(id=>document.getElementById(id).value='')
  document.getElementById('f-genero').value=''
  document.getElementById('f-fecha').value=new Date().toISOString().split('T')[0]
  document.getElementById('asig-preview').style.display='none'
  toast(enc?`Registrado y asignado a ${enc.nombre}`:'Registrado sin encargado disponible')
  showPage('inicio')
}

// ─── GUARDAR ENCARGADO ───────────────────────────────────────────────────────
window.guardarEncargado = async function () {
  const nombre = document.getElementById('e-nombre').value.trim()
  const usuario = document.getElementById('e-usuario').value.trim().toLowerCase()
  const pass = document.getElementById('e-pass').value.trim()
  const tel = document.getElementById('e-tel').value.trim()
  const cat = document.getElementById('e-cat').value
  const rol = document.getElementById('e-rol').value
  if (!nombre||!usuario||!pass) { toast('Completá nombre, usuario y contraseña'); return }

  const { error } = await sb.from('encargados').insert({ nombre, usuario, pass, tel, cat, rol })
  if (error) { toast('Error: '+error.message); return }
  ;['e-nombre','e-usuario','e-pass','e-tel'].forEach(id=>document.getElementById(id).value='')
  toast(`${nombre} agregado al equipo`)
}

// ─── PREVIEW ASIGNACIÓN ──────────────────────────────────────────────────────
function actualizarPreview() {
  const genero = document.getElementById('f-genero').value
  const edad = document.getElementById('f-edad').value
  const preview = document.getElementById('asig-preview')
  if (genero && edad) {
    const enc = asignarEncargado(genero, edad)
    preview.style.display = 'block'
    preview.innerHTML = enc ? `✦ Se asignará a <strong>${enc.nombre}</strong> (${catLabel(enc.cat)})` : `⚠ Sin encargados disponibles para esta categoría`
  } else preview.style.display = 'none'
}
document.getElementById('f-genero').addEventListener('change', actualizarPreview)
document.getElementById('f-edad').addEventListener('input', actualizarPreview)

// ─── MODAL ───────────────────────────────────────────────────────────────────
window.abrirModal = function (id) {
  const v = visitas.find(x=>x.id===id)
  if (!v) return
  modalId = id
  const enc = encargados.find(e=>e.id===v.encargado_id)
  const dias = diasSinContacto(v)
  const tel = limTel(v.tel)

  const histHTML = v.historial?.length
    ? [...v.historial].reverse().map(h=>`
        <div class="hist-item">
          <div class="hist-head"><span class="hist-fecha">${fmt(h.fecha)}</span><span class="hist-medio m-${h.medio}">${h.medio}</span></div>
          ${h.obs?`<div class="hist-obs">${h.obs}</div>`:''}
          <div class="hist-by">Registrado por ${h.por||'—'}</div>
        </div>`).join('')
    : `<div style="font-size:13px;color:var(--text3);padding:6px 0">Sin contactos registrados aún</div>`

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-inner">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div class="v-av ${v.genero==='F'?'av-f':'av-m'}" style="width:50px;height:50px;font-size:15px;flex-shrink:0">${initials(v.nombre)}</div>
        <div>
          <div class="modal-nombre">${v.nombre}</div>
          <div class="modal-sub">${v.genero==='F'?'Mujer':'Varón'}, ${v.edad} años · ${dBadge(dias)}</div>
        </div>
      </div>
      <div class="info-row"><span class="info-lbl">Teléfono</span><span class="info-val"><a href="tel:${v.tel}">${v.tel}</a></span></div>
      <div class="info-row"><span class="info-lbl">Visita</span><span class="info-val">${fmt(v.fecha)}</span></div>
      <div class="info-row"><span class="info-lbl">Encargado</span><span class="info-val">${enc?enc.nombre:'Sin asignar'}</span></div>
      ${v.notas?`<div class="info-row"><span class="info-lbl">Notas</span><span class="info-val">${v.notas}</span></div>`:''}
    </div>
    <div class="modal-btns">
      <button class="btn-wa" onclick="window.open('https://wa.me/54${tel}','_blank')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        WhatsApp
      </button>
      <a href="tel:${v.tel}" class="btn-primary" style="text-decoration:none;flex:1;margin-top:0">
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/></svg>
        Llamar
      </a>
    </div>
    <div class="seg-section">
      <div class="seg-title">Historial de contactos</div>
      ${histHTML}
      <div class="nuevo-seg">
        <div class="nuevo-seg-title">Registrar nuevo contacto</div>
        <div class="seg-row">
          <div class="field" style="margin-bottom:0"><label>Fecha</label><input id="seg-fecha" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
          <div class="field" style="margin-bottom:0"><label>Medio</label>
            <select id="seg-medio">
              <option value="whatsapp">WhatsApp</option>
              <option value="llamada">Llamada</option>
              <option value="visita">Visita personal</option>
            </select>
          </div>
        </div>
        <div class="field" style="margin-top:10px;margin-bottom:0">
          <label>Observaciones</label>
          <textarea id="seg-obs" rows="3" placeholder="Ej: Contestó, quedamos en invitarla el próximo domingo..."></textarea>
        </div>
        <button class="btn-primary" style="margin-top:10px" onclick="guardarSeguimiento()">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Guardar contacto
        </button>
      </div>
    </div>`

  document.getElementById('modal-bg').classList.add('open')
}

window.cerrarModal = function (e) {
  if (!e || e.target===document.getElementById('modal-bg'))
    document.getElementById('modal-bg').classList.remove('open')
}

// ─── GUARDAR SEGUIMIENTO ─────────────────────────────────────────────────────
window.guardarSeguimiento = async function () {
  if (!modalId) return
  const fecha = document.getElementById('seg-fecha').value
  const medio = document.getElementById('seg-medio').value
  const obs = document.getElementById('seg-obs').value.trim()
  if (!fecha) { toast('Seleccioná la fecha'); return }

  const v = visitas.find(x=>x.id===modalId)
  if (!v) return

  const historial = [...(v.historial||[]), { fecha, medio, obs, por: currentUser.nombre }]
  const { error } = await sb.from('visitas').update({ historial }).eq('id', modalId)
  if (error) { toast('Error al guardar'); console.error(error); return }

  document.getElementById('modal-bg').classList.remove('open')
  toast('Contacto registrado')
}

// ─── NOTIFICACIONES ──────────────────────────────────────────────────────────
function renderNotifs() {
  const el = document.getElementById('list-notifs')
  if (!notifs.length) { el.innerHTML='<div class="empty">Sin notificaciones</div>'; return }
  el.innerHTML = notifs.map(n => {
    const tel = limTel(n.visita_tel||'')
    const msg = encodeURIComponent(`Hola ${n.visita_nombre}! Te saluda ${currentUser.nombre} de la Iglesia Siquem. Fue un gusto tenerte el ${fmt(n.visita_fecha)}. ¿Cómo estás? Queremos mantenernos en contacto. ¡Bendiciones!`)
    return `<div class="notif-item ${n.leida?'':'notif-new'}" onclick="leerNotif('${n.id}')">
      <div class="notif-head"><span class="notif-titulo">Nueva asignación: ${n.visita_nombre}</span><span class="notif-fecha">${fmt(n.visita_fecha)}</span></div>
      <div class="notif-body">${n.visita_genero==='F'?'Mujer':'Varón'}, ${n.visita_edad} años · ${n.visita_tel||''}</div>
      <button class="notif-wa" onclick="event.stopPropagation();window.open('https://wa.me/54${tel}?text=${msg}','_blank')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Enviar WhatsApp de bienvenida
      </button>
    </div>`
  }).join('')
}

window.leerNotif = async function (id) {
  await sb.from('notificaciones').update({ leida: true }).eq('id', id)
}

// ─── NAVEGACIÓN ──────────────────────────────────────────────────────────────
function renderPagina(p) {
  if (p==='inicio') renderInicio()
  else if (p==='mis-asignados') renderMisAsignados()
  else if (p==='todas') renderTodas()
  else if (p==='equipo') renderEquipo()
  else if (p==='notificaciones') renderNotifs()
}

window.showPage = function (p) {
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'))
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'))
  const pg = document.getElementById('page-'+p)
  if (pg) pg.classList.add('active')
  const nb = document.querySelector(`[data-page="${p}"]`)
  if (nb) nb.classList.add('active')
  renderPagina(p)
  if (p==='notificaciones') notifs.filter(n=>!n.leida).forEach(n=>leerNotif(n.id))
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast')
  t.textContent = msg; t.classList.add('show')
  setTimeout(()=>t.classList.remove('show'), 2500)
}

// ─── AUTO-LOGIN ──────────────────────────────────────────────────────────────
const saved = sessionStorage.getItem('siquem_user')
if (saved) { currentUser = JSON.parse(saved); iniciarApp() }
