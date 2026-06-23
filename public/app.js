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
const formProfile = $('#formProfile');
const profileCrudMsg = $('#profileCrudMsg');
const profileCrudList = $('#profileCrudList');

// Estado de la sesion en el cliente.
let currentSession = null;
let currentProfiles = [];
let currentSubsystems = [];
let currentSubsystem = null;

// Nombre amigable del subsistema (sub_system_de es el identificador tecnico).
const SUBSYSTEM_LABELS = { security: 'Seguridad' };
const subsystemLabel = (de) => SUBSYSTEM_LABELS[de] || de;

function showMsg(text, ok = true) {
  msg.textContent = text || '';
  msg.className = 'msg ' + (ok ? 'ok' : 'error');
}
function showRegisterMsg(text, ok = true) {
  registerMsg.textContent = text || '';
  registerMsg.className = 'msg ' + (ok ? 'ok' : 'error');
}
function showUsersMsg(text, ok = true) {
  usersMsg.textContent = text || '';
  usersMsg.className = 'msg ' + (ok ? 'ok' : 'error');
}
function showManageMsg(text, ok = true) {
  manageMsg.textContent = text || '';
  manageMsg.className = 'msg ' + (ok ? 'ok' : 'error');
}
function showPermMsg(text, ok = true) {
  permMsg.textContent = text || '';
  permMsg.className = 'msg ' + (ok ? 'ok' : 'error');
}
function showSubsystemMsg(text, ok = true) {
  subsystemMsg.textContent = text || '';
  subsystemMsg.className = 'msg ' + (ok ? 'ok' : 'error');
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Atajo para invocar cualquier metodo de seguridad por el dispatcher /toProcess.
function toProcess(objectName, methodName, params = []) {
  return api('/toProcess', {
    method: 'POST',
    body: JSON.stringify({ subsystem: 'security', objectName, methodName, params })
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
}

async function refreshPermList() {
  const profile_id = Number(permProfileSelect.value);
  permList.innerHTML = '';
  if (!profile_id) return;
  const res = await toProcess('Permission', 'listPermissionMethods', [profile_id]);
  if (!res.ok) { showPermMsg(res.data.msg || 'Error.', false); return; }
  for (const m of res.data.data) {
    const item = document.createElement('div');
    item.className = 'item';
    const label = document.createElement('span');
    label.textContent = `${m.sub_system_de} · ${m.object_de} · ${m.method_de}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = m.granted ? 'perm-on' : 'perm-off';
    btn.textContent = m.granted ? 'Concedido' : 'Sin acceso';
    btn.addEventListener('click', async () => {
      const methodName = m.granted ? 'revokeMethod' : 'grantMethod';
      const r = await toProcess('Permission', methodName, [profile_id, m.method_id]);
      if (r.ok) {
        showPermMsg(m.granted ? 'Permiso quitado.' : 'Permiso concedido.', true);
        refreshPermList();
      } else {
        showPermMsg(r.data.msg || 'Error.', false);
      }
    });
    item.appendChild(label);
    item.appendChild(btn);
    permList.appendChild(item);
  }
}

// ---- Pestaña "Mantenimiento de perfiles" (CRUD de profile) ----
function showProfileCrudMsg(text, ok = true) {
  profileCrudMsg.textContent = text || '';
  profileCrudMsg.className = 'msg ' + (ok ? 'ok' : 'error');
}

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

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'mini';
    editBtn.textContent = 'Renombrar';
    editBtn.addEventListener('click', async () => {
      const nuevo = prompt('Nuevo nombre del perfil:', p.profile_de);
      if (nuevo == null) return;
      const name = nuevo.trim();
      if (!name) { showProfileCrudMsg('El nombre no puede estar vacío.', false); return; }
      const r = await toProcess('Profile', 'updateProfile', [p.profile_id, name]);
      showProfileCrudMsg(r.ok ? 'Perfil renombrado.' : (r.data.msg || 'Error.'), r.ok);
      if (r.ok) loadProfileCrud();
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'mini danger';
    delBtn.textContent = 'Eliminar';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar el perfil "${p.profile_de}"?`)) return;
      const r = await toProcess('Profile', 'deleteProfile', [p.profile_id]);
      showProfileCrudMsg(r.ok ? 'Perfil eliminado.' : (r.data.msg || 'Error.'), r.ok);
      if (r.ok) loadProfileCrud();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(nameSpan);
    item.appendChild(actions);
    profileCrudList.appendChild(item);
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

    const info = document.createElement('span');
    info.innerHTML = `#${u.user_id} · <b>${u.user_na}</b> <span class="tag">${u.profiles}</span>`;

    const right = document.createElement('span');
    right.className = 'row-actions';

    const active = u.status_id === 1;
    const badge = document.createElement('span');
    badge.className = 'status-badge ' + (active ? 'on' : 'off');
    badge.textContent = u.status_de;
    right.appendChild(badge);

    // Toggle activar/desactivar: solo si tiene permiso; bloqueado sobre tu propia cuenta activa.
    if (currentSession.canManageUsers) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini' + (active ? ' danger' : '');
      btn.textContent = active ? 'Desactivar' : 'Activar';
      if (active && u.user_id === currentSession.user_id) {
        btn.disabled = true;
        btn.title = 'No puedes desactivar tu propia cuenta';
      }
      btn.addEventListener('click', async () => {
        const newStatus = active ? 2 : 1;
        const r = await toProcess('User', 'setUserStatus', [u.user_id, newStatus]);
        showUsersMsg(r.ok ? `Usuario ${active ? 'desactivado' : 'activado'}.` : (r.data.msg || 'Error.'), r.ok);
        if (r.ok) refreshUsersList();
      });
      right.appendChild(btn);
    }

    item.appendChild(info);
    item.appendChild(right);
    usersList.appendChild(item);
  }
}

// Definicion de pestañas: etiqueta, permiso que las habilita, y carga de datos al abrir.
const TABS = [
  { id: 'userMgmtBox', label: 'Mantenimiento de usuarios',   can: (s) => s.canListUsers || s.canRegister || s.canManageUsers, load: loadUserMgmt },
  { id: 'profileBox',  label: 'Mantenimiento de perfiles',   can: (s) => s.canCrudProfiles,      load: loadProfileCrud },
  { id: 'manageBox',   label: 'Asignar perfiles a usuarios', can: (s) => s.canManageProfiles,    load: loadManageData },
  { id: 'permBox',     label: 'Asignar permisos',            can: (s) => s.canManagePermissions, load: loadPermData }
];

// Muestra una pestaña: oculta el resto de paneles y marca el boton activo.
function activateTab(tab) {
  for (const t of TABS) $('#' + t.id).classList.add('hidden');
  noActions.classList.add('hidden');
  $('#' + tab.id).classList.remove('hidden');
  for (const btn of tabsNav.children) {
    btn.classList.toggle('active', btn.dataset.tab === tab.id);
  }
  if (tab.load) tab.load();
}

// Construye las pestañas verticales segun los permisos del perfil activo.
function buildTabs(session) {
  tabsNav.innerHTML = '';
  const available = TABS.filter((t) => t.can(session));
  for (const t of available) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    btn.dataset.tab = t.id;
    btn.textContent = t.label;
    btn.addEventListener('click', () => activateTab(t));
    tabsNav.appendChild(btn);
  }
  // Oculta todos los paneles y abre la primera pestaña (o el aviso si no hay ninguna).
  for (const t of TABS) $('#' + t.id).classList.add('hidden');
  if (available.length) {
    activateTab(available[0]);
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

// Ventana principal del subsistema elegido: pestañas verticales + selector de perfil.
function renderWorkspace() {
  hideAllScreens();
  title.classList.add('hidden');
  msg.classList.add('hidden');
  panel.classList.remove('hidden');
  whoami.textContent =
    `Conectado como ${currentSession.user_na} (${currentSession.profile_de}) · ${subsystemLabel(currentSubsystem)}`;
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
    whoami.textContent =
      `Conectado como ${currentSession.user_na} (${currentSession.profile_de}) · ${subsystemLabel(currentSubsystem)}`;
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

permProfileSelect.addEventListener('change', refreshPermList);

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
