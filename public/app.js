const $ = (sel) => document.querySelector(sel);

const formLogin = $('#formLogin');
const formRegister = $('#formRegister');
const subsystemSelect = $('#subsystemSelect');
const subsystemDropdown = $('#subsystemDropdown');
const subsystemMsg = $('#subsystemMsg');
const panel = $('#panel');
const msg = $('#msg');
const title = document.querySelector('h1');
const whoami = $('#whoami');
const tabsNav = $('#tabs');
const noActions = $('#noActions');
const profileSwitcher = $('#profileSwitcher');
const profileSwitchSelect = $('#profileSwitchSelect');
const registerMsg = $('#registerMsg');
const createUserBlock = $('#createUserBlock');
const usersMsg = $('#usersMsg');
const usersList = $('#usersList');
const userSelect = $('#userSelect');
const profileAssignSelect = $('#profileAssignSelect');
const manageMsg = $('#manageMsg');
const userProfilesList = $('#userProfilesList');
const permProfileSelect = $('#permProfileSelect');
const permMsg = $('#permMsg');
const permList = $('#permList');
const permOptionList = $('#permOptionList');
const permSearch = $('#permSearch');
const permPager = $('#permPager');
const formProfile = $('#formProfile');
const profileCrudMsg = $('#profileCrudMsg');
const profileCrudList = $('#profileCrudList');
const auditMsg = $('#auditMsg');
const auditList = $('#auditList');
const formProyect = $('#formProyect');
const proyectLeaderSelect = $('#proyectLeaderSelect');
const proyectMsg = $('#proyectMsg');
const proyectList = $('#proyectList');
const proyectMembersBlock = $('#proyectMembersBlock');
const proyectMembersTitle = $('#proyectMembersTitle');
const memberPersonSelect = $('#memberPersonSelect');
const memberRoleSelect = $('#memberRoleSelect');
const memberMsg = $('#memberMsg');
const memberList = $('#memberList');

// Estado de la sesion en el cliente.
let currentSession = null;
let currentProfiles = [];
let currentSubsystems = [];
let currentSubsystem = null;

// Nombre amigable del subsistema (sub_system_de es el identificador tecnico).
const SUBSYSTEM_LABELS = { security: 'Seguridad', proyectos: 'Proyectos' };
const subsystemLabel = (de) => SUBSYSTEM_LABELS[de] || de;

// Todas las cajitas de mensaje funcionan igual (texto + color ok/error): una fabrica
// que fija el elemento destino evita repetir la misma funcion por cada pestaña.
const msgIn = (el) => (text, ok = true) => {
  el.textContent = text || '';
  el.className = 'msg ' + (ok ? 'ok' : 'error');
};
const showMsg = msgIn(msg);
const showRegisterMsg = msgIn(registerMsg);
const showUsersMsg = msgIn(usersMsg);
const showManageMsg = msgIn(manageMsg);
const showPermMsg = msgIn(permMsg);
const showAuditMsg = msgIn(auditMsg);
const showSubsystemMsg = msgIn(subsystemMsg);
const showProfileCrudMsg = msgIn(profileCrudMsg);
const showProyectMsg = msgIn(proyectMsg);
const showMemberMsg = msgIn(memberMsg);

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Atajo para invocar cualquier metodo por el dispatcher /toProcess. El subsistema es el
// DUEÑO del objeto (security, proyectos...), no la ventana donde se este navegando.
function toProcess(objectName, methodName, params = [], subsystem = 'security') {
  return api('/toProcess', {
    method: 'POST',
    body: JSON.stringify({ subsystem, objectName, methodName, params })
  });
}

// Rellena un <select> con perfiles [{profile_id, profile_de}].
function fillProfileOptions(select, profiles) {
  select.innerHTML = '';
  for (const p of profiles) {
    const opt = document.createElement('option');
    opt.value = p.profile_id;
    opt.textContent = p.profile_de;
    select.appendChild(opt);
  }
}

// Boton chico de fila (Renombrar, Eliminar, Quitar...), igual en todas las listas.
function miniButton(label, onClick, danger = false) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mini' + (danger ? ' danger' : '');
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

// ---- Pestaña "Perfiles de usuarios" ----
async function loadManageData() {
  const usersRes = await toProcess('User', 'listUsers', []);
  if (usersRes.ok) {
    userSelect.innerHTML = '';
    for (const u of usersRes.data.data) {
      const opt = document.createElement('option');
      opt.value = u.user_id;
      opt.textContent = `#${u.user_id} · ${u.user_na}`;
      userSelect.appendChild(opt);
    }
  }
  const profRes = await toProcess('UserProfile', 'listProfiles', []);
  if (profRes.ok) fillProfileOptions(profileAssignSelect, profRes.data.data);
  await refreshUserProfiles();
}

async function refreshUserProfiles() {
  const user_id = Number(userSelect.value);
  userProfilesList.innerHTML = '';
  if (!user_id) return;
  const res = await toProcess('UserProfile', 'listUserProfiles', [user_id]);
  if (!res.ok) return;
  for (const p of res.data.data) {
    const item = document.createElement('div');
    item.className = 'item';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `perfil #${p.profile_id}`;
    const profSpan = document.createElement('span');
    profSpan.className = 'tag';
    profSpan.textContent = p.profile_de;
    item.appendChild(nameSpan);
    item.appendChild(profSpan);
    userProfilesList.appendChild(item);
  }
}

// ---- Pestaña "Gestionar permisos" (CU-04) ----
async function loadPermData() {
  showPermMsg('');
  const profRes = await toProcess('UserProfile', 'listProfiles', []);
  if (profRes.ok) fillProfileOptions(permProfileSelect, profRes.data.data);
  await refreshPermList();
  await refreshPermOptions();
}

// Etiqueta legible de una opcion de menu (option_de = id de la pestaña).
function optionLabel(option_de) {
  const tab = TABS.find((t) => t.id === option_de);
  return tab ? tab.label : option_de;
}

// Lista las opciones (menus) con un toggle de concedido por perfil. Si el cambio afecta
// MI propio perfil activo, refresco la sesion y las pestañas en vivo.
let permOptionsData = [];

async function refreshPermOptions() {
  const profile_id = Number(permProfileSelect.value);
  permOptionsData = [];
  if (profile_id) {
    const res = await toProcess('Permission', 'listPermissionOptions', [profile_id]);
    if (res.ok) permOptionsData = res.data.data;
    else showPermMsg(res.data.msg || 'Error.', false);
  }
  renderPermOptions();
}

function renderPermOptions() {
  const filter = (permSearch.value || '').trim().toLowerCase();
  const profile_id = Number(permProfileSelect.value);
  permOptionList.innerHTML = '';
  for (const o of permOptionsData) {
    const label = optionLabel(o.option_de);
    if (filter && !label.toLowerCase().includes(filter) && !o.option_de.toLowerCase().includes(filter)) continue;
    const item = document.createElement('div');
    item.className = 'item';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = o.granted ? 'perm-on' : 'perm-off';
    btn.textContent = o.granted ? 'Visible' : 'Oculto';
    btn.addEventListener('click', async () => {
      const methodName = o.granted ? 'revokeOption' : 'grantOption';
      const r = await toProcess('Permission', methodName, [profile_id, o.option_id]);
      if (!r.ok) { showPermMsg(r.data.msg || 'Error.', false); return; }
      showPermMsg(o.granted ? 'Menú ocultado.' : 'Menú habilitado.', true);
      await refreshPermOptions();
      // Si toqué mis propios menús, refresco sesión + pestañas sin recargar la página.
      if (profile_id === currentSession.profile_id) {
        const me = await api('/me');
        if (me.ok && me.data.objectSession) {
          currentSession = me.data.objectSession;
          buildTabs(currentSession);
        }
      }
    });
    item.appendChild(lbl);
    item.appendChild(btn);
    permOptionList.appendChild(item);
  }
}

const PERM_PAGE_SIZE = 10;
let permPage = 0;     // pagina actual (0-based)
let permTotal = 0;    // total de metodos que coinciden con la busqueda

// Trae UNA pagina de metodos del servidor (busqueda + LIMIT/OFFSET) y la pinta agrupada.
// El navegador nunca tiene mas de PERM_PAGE_SIZE filas, haya 16 o 100.000 permisos.
async function refreshPermList() {
  const profile_id = Number(permProfileSelect.value);
  permList.innerHTML = '';
  permTotal = 0;
  if (!profile_id) { renderPermPager(); return; }
  const search = (permSearch.value || '').trim();
  const offset = permPage * PERM_PAGE_SIZE;
  const res = await toProcess('Permission', 'listPermissionMethods', [profile_id, search, PERM_PAGE_SIZE, offset]);
  if (!res.ok) { showPermMsg(res.data.msg || 'Error.', false); renderPermPager(); return; }
  const rows = res.data.data;
  // Si quedamos en una pagina vacia por encima del total, volvemos a la primera.
  if (!rows.length && permPage > 0) { permPage = 0; return refreshPermList(); }
  permTotal = rows.length ? Number(rows[0].total) : 0;
  let lastObject = null;
  for (const m of rows) {
    if (m.object_de !== lastObject) {
      lastObject = m.object_de;
      const head = document.createElement('div');
      head.className = 'group-head';
      head.textContent = `${m.sub_system_de} · ${m.object_de}`;
      permList.appendChild(head);
    }
    const item = document.createElement('div');
    item.className = 'item';
    const label = document.createElement('span');
    label.textContent = m.method_de;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = m.granted ? 'perm-on' : 'perm-off';
    btn.textContent = m.granted ? 'Concedido' : 'Sin acceso';
    btn.addEventListener('click', async () => {
      const methodName = m.granted ? 'revokeMethod' : 'grantMethod';
      const r = await toProcess('Permission', methodName, [profile_id, m.method_id]);
      if (r.ok) { showPermMsg(m.granted ? 'Permiso quitado.' : 'Permiso concedido.', true); refreshPermList(); }
      else showPermMsg(r.data.msg || 'Error.', false);
    });
    item.appendChild(label);
    item.appendChild(btn);
    permList.appendChild(item);
  }
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = search ? 'Sin métodos que coincidan.' : 'Sin métodos.';
    permList.appendChild(empty);
  }
  renderPermPager();
}

// Controles de paginacion. Solo aparecen si hay mas de una pagina.
function renderPermPager() {
  permPager.innerHTML = '';
  const pages = Math.max(1, Math.ceil(permTotal / PERM_PAGE_SIZE));
  if (permTotal <= PERM_PAGE_SIZE) return;
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'mini';
  prev.textContent = '‹ Anterior';
  prev.disabled = permPage <= 0;
  prev.addEventListener('click', () => { permPage--; refreshPermList(); });
  const info = document.createElement('span');
  info.className = 'pager-info';
  info.textContent = `Página ${permPage + 1} de ${pages} · ${permTotal} método(s)`;
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'mini';
  next.textContent = 'Siguiente ›';
  next.disabled = permPage >= pages - 1;
  next.addEventListener('click', () => { permPage++; refreshPermList(); });
  permPager.appendChild(prev);
  permPager.appendChild(info);
  permPager.appendChild(next);
}

// ---- Pestaña "Mantenimiento de perfiles" (CRUD de profile) ----
async function loadProfileCrud() {
  showProfileCrudMsg('');
  profileCrudList.innerHTML = '';
  const res = await toProcess('UserProfile', 'listProfiles', []);
  if (!res.ok) { showProfileCrudMsg(res.data.msg || 'Error.', false); return; }
  for (const p of res.data.data) {
    const item = document.createElement('div');
    item.className = 'item';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = `#${p.profile_id} · ${p.profile_de}`;

    const actions = document.createElement('span');
    actions.className = 'row-actions';

    actions.appendChild(miniButton('Renombrar', async () => {
      const nuevo = prompt('Nuevo nombre del perfil:', p.profile_de);
      if (nuevo == null) return;
      const name = nuevo.trim();
      if (!name) { showProfileCrudMsg('El nombre no puede estar vacío.', false); return; }
      const r = await toProcess('Profile', 'updateProfile', [p.profile_id, name]);
      showProfileCrudMsg(r.ok ? 'Perfil renombrado.' : (r.data.msg || 'Error.'), r.ok);
      if (r.ok) loadProfileCrud();
    }));

    actions.appendChild(miniButton('Eliminar', async () => {
      if (!confirm(`¿Eliminar el perfil "${p.profile_de}"?`)) return;
      const r = await toProcess('Profile', 'deleteProfile', [p.profile_id]);
      showProfileCrudMsg(r.ok ? 'Perfil eliminado.' : (r.data.msg || 'Error.'), r.ok);
      if (r.ok) loadProfileCrud();
    }, true));
    item.appendChild(nameSpan);
    item.appendChild(actions);
    profileCrudList.appendChild(item);
  }
}

// ---- Pestaña "Auditoría" ----
async function loadAuditData() {
  showAuditMsg('');
  auditList.innerHTML = '';
  const res = await toProcess('Audit', 'listAudit', [50]);
  if (!res.ok) {
    showAuditMsg(res.data.msg || 'No tienes permiso para ver la auditoría.', false);
    return;
  }
  const rows = res.data.data || [];
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No hay eventos registrados aún.';
    auditList.appendChild(empty);
    return;
  }
  for (const item of rows) {
    const entry = document.createElement('div');
    entry.className = 'item audit-item';
    const meta = document.createElement('div');
    meta.className = 'audit-meta';
    meta.textContent = `${item.date} ${item.hour} · ${item.user_na}`;
    const action = document.createElement('div');
    action.className = 'audit-action';
    action.textContent = item.action;
    const desc = document.createElement('div');
    desc.className = 'audit-desc';
    desc.textContent = item.description;
    entry.appendChild(meta);
    entry.appendChild(action);
    entry.appendChild(desc);
    auditList.appendChild(entry);
  }
}

// ---- Pestaña "Mantenimiento de proyectos" (CU-06/CU-07, subsistema proyectos) ----
let currentProyect = null; // proyecto elegido con el boton "Miembros"

async function loadProyectData() {
  showProyectMsg('');
  showMemberMsg('');
  currentProyect = null;
  proyectMembersBlock.classList.add('hidden');

  // Personas (con su cargo) para elegir lider y miembros.
  const persons = await toProcess('Proyect', 'listPersons', [], 'proyectos');
  if (persons.ok) {
    for (const sel of [proyectLeaderSelect, memberPersonSelect]) {
      sel.innerHTML = '';
      for (const p of persons.data.data) {
        const opt = document.createElement('option');
        opt.value = p.person_id;
        opt.textContent = `${p.person_na} ${p.person_ln} · ${p.charge_de}`;
        sel.appendChild(opt);
      }
    }
  }
  await refreshProyectList();
}

async function refreshProyectList() {
  proyectList.innerHTML = '';
  const res = await toProcess('Proyect', 'listProyects', [], 'proyectos');
  if (!res.ok) {
    showProyectMsg(res.data.msg || 'No tienes permiso para ver los proyectos.', false);
    return;
  }
  const rows = res.data.data || [];
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No hay proyectos aún. Crea el primero arriba.';
    proyectList.appendChild(empty);
    return;
  }
  for (const p of rows) {
    const item = document.createElement('div');
    item.className = 'item';

    const left = document.createElement('span');
    left.textContent = `#${p.id} · ${p.name}`;
    const sub = document.createElement('span');
    sub.className = 'item-sub';
    sub.textContent = `Líder: ${p.leader_na} · ${p.members} miembro(s)`;
    left.appendChild(sub);

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const STATUS_ACTIVO = 1;
    const STATUS_CULMINADO = 3;
    const badge = document.createElement('span');
    badge.className = 'status-badge ' + (p.status_id === STATUS_ACTIVO ? 'on' : 'off');
    badge.textContent = p.status_de;
    actions.appendChild(badge);

    actions.appendChild(miniButton('Miembros', () => selectProyect(p)));

    const esActivo = p.status_id === STATUS_ACTIVO;
    actions.appendChild(miniButton(esActivo ? 'Culminar' : 'Reactivar', async () => {
      const target = esActivo ? STATUS_CULMINADO : STATUS_ACTIVO;
      const r = await toProcess('Proyect', 'setProyectStatus', [p.id, target], 'proyectos');
      showProyectMsg(r.ok ? 'Estado del proyecto actualizado.' : (r.data.msg || 'Error.'), r.ok);
      if (r.ok) refreshProyectList();
    }));

    actions.appendChild(miniButton('Eliminar', async () => {
      if (!confirm(`¿Eliminar el proyecto "${p.name}"? Se quitarán también sus roles y miembros.`)) return;
      const r = await toProcess('Proyect', 'deleteProyect', [p.id], 'proyectos');
      showProyectMsg(r.ok ? 'Proyecto eliminado.' : (r.data.msg || 'Error.'), r.ok);
      if (r.ok) {
        if (currentProyect && currentProyect.id === p.id) {
          currentProyect = null;
          proyectMembersBlock.classList.add('hidden');
        }
        refreshProyectList();
      }
    }, true));

    item.appendChild(left);
    item.appendChild(actions);
    proyectList.appendChild(item);
  }
}

function selectProyect(p) {
  currentProyect = p;
  proyectMembersTitle.textContent = `Miembros de «${p.name}»`;
  proyectMembersBlock.classList.remove('hidden');
  showMemberMsg('');
  refreshMemberList();
}

async function refreshMemberList() {
  memberList.innerHTML = '';
  if (!currentProyect) return;
  const res = await toProcess('Proyect', 'listProyectMembers', [currentProyect.id], 'proyectos');
  if (!res.ok) {
    showMemberMsg(res.data.msg || 'Error al listar miembros.', false);
    return;
  }
  const rows = res.data.data || [];
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Este proyecto aún no tiene miembros.';
    memberList.appendChild(empty);
    return;
  }
  for (const m of rows) {
    const item = document.createElement('div');
    item.className = 'item';

    const left = document.createElement('span');
    left.textContent = `${m.role_de} · ${m.person_na} ${m.person_ln}`;
    const sub = document.createElement('span');
    sub.className = 'item-sub';
    sub.textContent = `Cargo: ${m.charge_de}`;
    left.appendChild(sub);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.appendChild(miniButton('Quitar', async () => {
      const r = await toProcess('Proyect', 'removeMember', [m.id], 'proyectos');
      showMemberMsg(r.ok ? 'Miembro quitado.' : (r.data.msg || 'Error.'), r.ok);
      if (r.ok) { refreshMemberList(); refreshProyectList(); }
    }, true));

    item.appendChild(left);
    item.appendChild(actions);
    memberList.appendChild(item);
  }
}

// ---- Pestaña "Mantenimiento de usuarios" (CU-02) ----
function loadUserMgmt() {
  // El formulario de crear cuenta solo se muestra a quien tiene permiso.
  createUserBlock.classList.toggle('hidden', !currentSession.canRegister);
  formRegister.reset();
  showRegisterMsg('');
  refreshUsersList();
}

async function refreshUsersList() {
  showUsersMsg('');
  usersList.innerHTML = '';
  const res = await toProcess('User', 'listUsers', []);
  if (!res.ok) { showUsersMsg(res.data.msg || 'No tienes permiso para listar usuarios.', false); return; }
  for (const u of res.data.data) {
    const item = document.createElement('div');
    item.className = 'item';

    // Construido con textContent (nunca innerHTML con datos escritos por un usuario: XSS).
    const info = document.createElement('span');
    info.append(`#${u.user_id} · `);
    const name = document.createElement('b');
    name.textContent = u.user_na;
    const profTag = document.createElement('span');
    profTag.className = 'tag';
    profTag.textContent = u.profiles;
    info.append(name, ' ', profTag);

    const right = document.createElement('span');
    right.className = 'row-actions';

    const active = u.status_id === 1;
    const badge = document.createElement('span');
    badge.className = 'status-badge ' + (active ? 'on' : 'off');
    badge.textContent = u.status_de;
    right.appendChild(badge);

    // Toggle activar/desactivar: solo si tiene permiso; bloqueado sobre tu propia cuenta activa.
    if (currentSession.canManageUsers) {
      const btn = miniButton(active ? 'Desactivar' : 'Activar', async () => {
        const newStatus = active ? 2 : 1;
        const r = await toProcess('User', 'setUserStatus', [u.user_id, newStatus]);
        showUsersMsg(r.ok ? `Usuario ${active ? 'desactivado' : 'activado'}.` : (r.data.msg || 'Error.'), r.ok);
        if (r.ok) refreshUsersList();
      }, active);
      if (active && u.user_id === currentSession.user_id) {
        btn.disabled = true;
        btn.title = 'No puedes desactivar tu propia cuenta';
      }
      right.appendChild(btn);
    }

    item.appendChild(info);
    item.appendChild(right);
    usersList.appendChild(item);
  }
}

// Definicion de pestañas: etiqueta, permiso que las habilita, y carga de datos al abrir.
// Cada pestaña corresponde a una OPCION de menu (option_de = id de la pestaña). Su
// visibilidad la decide permission_option (session.visibleOptions); las acciones de adentro
// se siguen validando por metodo en el servidor.
// "sub" = subsistema dueño de la pestaña: en la ventana de un subsistema solo se
// muestran SUS opciones (aunque el perfil tenga opciones de otros subsistemas).
const TABS = [
  { id: 'userMgmtBox',    label: 'Mantenimiento de usuarios',   load: loadUserMgmt,    sub: 'security' },
  { id: 'profileBox',     label: 'Mantenimiento de perfiles',   load: loadProfileCrud, sub: 'security' },
  { id: 'manageBox',      label: 'Asignar perfiles a usuarios', load: loadManageData,  sub: 'security' },
  { id: 'permBox',        label: 'Asignar permisos',            load: loadPermData,    sub: 'security' },
  { id: 'auditBox',       label: 'Auditoría',                   load: loadAuditData,   sub: 'security' },
  { id: 'proyectMgmtBox', label: 'Mantenimiento de proyectos',  load: loadProyectData, sub: 'proyectos' }
];

let activeTabId = null;

// Muestra una pestaña: oculta el resto de paneles y marca el boton activo.
function activateTab(tab) {
  activeTabId = tab.id;
  for (const t of TABS) $('#' + t.id).classList.add('hidden');
  noActions.classList.add('hidden');
  $('#' + tab.id).classList.remove('hidden');
  for (const btn of tabsNav.children) {
    btn.classList.toggle('active', btn.dataset.tab === tab.id);
  }
  if (tab.load) tab.load();
}

// Construye las pestañas verticales segun los menus visibles (permission_option).
function buildTabs(session) {
  tabsNav.innerHTML = '';
  const visible = session.visibleOptions || [];
  const available = TABS.filter((t) => t.sub === currentSubsystem && visible.includes(t.id));
  for (const t of available) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    btn.dataset.tab = t.id;
    btn.textContent = t.label;
    btn.addEventListener('click', () => activateTab(t));
    tabsNav.appendChild(btn);
  }
  for (const t of TABS) $('#' + t.id).classList.add('hidden');
  if (available.length) {
    // Conserva la pestaña activa si sigue visible; si no, abre la primera.
    const keep = available.find((t) => t.id === activeTabId) || available[0];
    activateTab(keep);
  } else {
    noActions.classList.remove('hidden');
  }
}

// Rellena el selector de perfil (abajo) y lo muestra solo si hay mas de un perfil.
function renderProfileSwitcher() {
  if (currentProfiles.length > 1) {
    fillProfileOptions(profileSwitchSelect, currentProfiles);
    profileSwitchSelect.value = String(currentSession.profile_id);
    profileSwitcher.classList.remove('hidden');
  } else {
    profileSwitcher.classList.add('hidden');
  }
}

// ---- Navegacion entre las tres pantallas ----
function hideAllScreens() {
  formLogin.classList.add('hidden');
  subsystemSelect.classList.add('hidden');
  panel.classList.add('hidden');
}

function renderLoggedOut() {
  hideAllScreens();
  title.classList.remove('hidden');
  formLogin.classList.remove('hidden');
  msg.classList.remove('hidden');
  showMsg('');
  currentSession = null;
  currentProfiles = [];
  currentSubsystems = [];
  currentSubsystem = null;
}

// Pantalla de seleccion de subsistema (paso posterior al login).
function renderSubsystemSelect() {
  hideAllScreens();
  title.classList.add('hidden');
  msg.classList.add('hidden');
  subsystemSelect.classList.remove('hidden');
  showSubsystemMsg('');
  subsystemDropdown.innerHTML = '';
  for (const s of currentSubsystems) {
    const opt = document.createElement('option');
    opt.value = s.sub_system_de;
    opt.textContent = subsystemLabel(s.sub_system_de);
    subsystemDropdown.appendChild(opt);
  }
  const hasAny = currentSubsystems.length > 0;
  $('#btnEnterSubsystem').classList.toggle('hidden', !hasAny);
  subsystemDropdown.classList.toggle('hidden', !hasAny);
  if (!hasAny) showSubsystemMsg('Tu perfil actual no tiene subsistemas disponibles.', false);
}

// Barra de identidad: quien esta conectado, con que perfil y en que subsistema.
function updateWhoami() {
  whoami.textContent =
    `Conectado como ${currentSession.user_na} (${currentSession.profile_de}) · ${subsystemLabel(currentSubsystem)}`;
}

// Ventana principal del subsistema elegido: pestañas verticales + selector de perfil.
function renderWorkspace() {
  hideAllScreens();
  title.classList.add('hidden');
  msg.classList.add('hidden');
  panel.classList.remove('hidden');
  updateWhoami();
  buildTabs(currentSession);
  renderProfileSwitcher();
}

// ---- Eventos ----
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(formLogin));
  const { ok, data } = await api('/login', { method: 'POST', body: JSON.stringify(body) });
  if (ok) {
    formLogin.reset();
    currentSession = data.objectSession;
    currentProfiles = data.profiles || [];
    currentSubsystems = data.subsystems || [];
    renderSubsystemSelect();
  } else {
    showMsg(data.msg, false);
  }
});

$('#btnEnterSubsystem').addEventListener('click', () => {
  currentSubsystem = subsystemDropdown.value;
  if (!currentSubsystem) return;
  renderWorkspace();
});

$('#btnCancelSubsystem').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' });
  renderLoggedOut();
});

$('#btnLogout').addEventListener('click', async () => {
  const { ok, data } = await api('/logout', { method: 'POST' });
  renderLoggedOut();
  showMsg(data.msg, ok);
});

// Cambiar de perfil activo (selector abajo): recalcula permisos y re-pinta las pestañas.
profileSwitchSelect.addEventListener('change', async () => {
  const profile_id = Number(profileSwitchSelect.value);
  const { ok, data } = await api('/selectProfile', {
    method: 'POST',
    body: JSON.stringify({ profile_id })
  });
  if (ok) {
    currentSession = data.objectSession;
    currentSubsystems = data.subsystems || [];
    // Si el nuevo perfil ya no tiene acceso al subsistema abierto, se vuelve a la
    // pantalla de seleccion (p. ej. Administrador -> Líder de proyecto).
    if (!currentSubsystems.some((s) => s.sub_system_de === currentSubsystem)) {
      currentSubsystem = null;
      renderSubsystemSelect();
      return;
    }
    updateWhoami();
    buildTabs(currentSession);
  } else {
    showMsg(data.msg || 'No se pudo cambiar de perfil.', false);
  }
});

formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(formRegister));
  const { ok, data } = await toProcess('User', 'insertUser', body);
  if (ok) {
    formRegister.reset();
    showRegisterMsg('Usuario creado.', true);
    refreshUsersList();
  } else if (data.errors && data.errors.length) {
    showRegisterMsg('• ' + data.errors.join('\n• '), false);
  } else {
    showRegisterMsg(data.msg, false);
  }
});

formProfile.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = (new FormData(formProfile)).get('profile_de').trim();
  if (!name) { showProfileCrudMsg('El nombre no puede estar vacío.', false); return; }
  const { ok, data } = await toProcess('Profile', 'insertProfile', [name]);
  if (ok) {
    formProfile.reset();
    showProfileCrudMsg('Perfil creado.', true);
    loadProfileCrud();
  } else {
    showProfileCrudMsg(data.msg || 'Error.', false);
  }
});

userSelect.addEventListener('change', refreshUserProfiles);

$('#btnAssign').addEventListener('click', async () => {
  const params = [Number(userSelect.value), Number(profileAssignSelect.value)];
  const { ok, data } = await toProcess('UserProfile', 'addUserProfile', params);
  showManageMsg(ok ? 'Perfil asignado.' : (data.msg || 'Error.'), ok);
  if (ok) refreshUserProfiles();
});

$('#btnRemove').addEventListener('click', async () => {
  const params = [Number(userSelect.value), Number(profileAssignSelect.value)];
  const { ok, data } = await toProcess('UserProfile', 'removeUserProfile', params);
  showManageMsg(ok ? 'Perfil quitado.' : (data.msg || 'Error.'), ok);
  if (ok) refreshUserProfiles();
});

formProyect.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = (new FormData(formProyect)).get('name').trim();
  const leader_person_id = Number(proyectLeaderSelect.value);
  const { ok, data } = await toProcess('Proyect', 'insertProyect', { name, leader_person_id }, 'proyectos');
  if (ok) {
    formProyect.reset();
    showProyectMsg('Proyecto creado.', true);
    refreshProyectList();
  } else if (data.errors && data.errors.length) {
    showProyectMsg('• ' + data.errors.join('\n• '), false);
  } else {
    showProyectMsg(data.msg || 'Error.', false);
  }
});

$('#btnAssignMember').addEventListener('click', async () => {
  if (!currentProyect) return;
  const params = [currentProyect.id, Number(memberPersonSelect.value), memberRoleSelect.value];
  const { ok, data } = await toProcess('Proyect', 'assignMember', params, 'proyectos');
  showMemberMsg(ok ? 'Miembro asignado.' : (data.msg || 'Error.'), ok);
  if (ok) { refreshMemberList(); refreshProyectList(); }
});

permProfileSelect.addEventListener('change', () => { permPage = 0; refreshPermList(); refreshPermOptions(); });

// Busqueda server-side con debounce: cada cambio reinicia a la pagina 1 y re-consulta.
let permSearchTimer = null;
permSearch.addEventListener('input', () => {
  clearTimeout(permSearchTimer);
  permSearchTimer = setTimeout(() => { permPage = 0; refreshPermList(); renderPermOptions(); }, 250);
});

// Al recargar la pagina, restaura la sesion si la cookie sigue viva y reanuda en la
// seleccion de subsistema.
(async () => {
  const { ok, data } = await api('/me');
  if (!ok || !data.objectSession) return;
  currentSession = data.objectSession;
  currentProfiles = data.profiles || [];
  currentSubsystems = data.subsystems || [];
  renderSubsystemSelect();
})();
