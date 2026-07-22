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
const permSubsystemSelect = $('#permSubsystemSelect');
const permObjectSelect = $('#permObjectSelect');
const permMethodSelect = $('#permMethodSelect');
const permMethodState = $('#permMethodState');
const permOptSubsystemSelect = $('#permOptSubsystemSelect');
const permOptionSelect = $('#permOptionSelect');
const permOptionState = $('#permOptionState');
const formProfile = $('#formProfile');
const profileCrudMsg = $('#profileCrudMsg');
const profileCrudList = $('#profileCrudList');
const auditMsg = $('#auditMsg');
const auditList = $('#auditList');
const auditFrom = $('#auditFrom');
const auditTo = $('#auditTo');
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
const userSearch = $('#userSearch');
const registerPersonSelect = $('#registerPersonSelect');
const formPerson = $('#formPerson');
const personIdField = $('#personIdField');
const personChargeSelect = $('#personChargeSelect');
const personFormTitle = $('#personFormTitle');
const btnSavePerson = $('#btnSavePerson');
const btnCancelPerson = $('#btnCancelPerson');
const personMsg = $('#personMsg');
const personSearch = $('#personSearch');
const personList = $('#personList');

// ---- Actividades ----
const formActivity = $('#formActivity');
const activityIdField = $('#activityIdField');
const activityFormTitle = $('#activityFormTitle');
const btnSaveActivity = $('#btnSaveActivity');
const btnCancelActivity = $('#btnCancelActivity');
const activityProyectSelect = $('#activityProyectSelect');
const activityMsg = $('#activityMsg');
const activityFilterProyect = $('#activityFilterProyect');
const activityList = $('#activityList');
const activityAssignBlock = $('#activityAssignBlock');
const activityAssignTitle = $('#activityAssignTitle');
const activityPersonSelect = $('#activityPersonSelect');
const assignMsg = $('#assignMsg');
const assigneeList = $('#assigneeList');
const activityReportBlock = $('#activityReportBlock');
const activityReportTitle = $('#activityReportTitle');
const formLeaderReport = $('#formLeaderReport');
const leaderReportPerson = $('#leaderReportPerson');
const reportMsg = $('#reportMsg');
const reportList = $('#reportList');

// ---- Mis actividades (empleado) ----
const myActivitiesList = $('#myActivitiesList');
const myReportBlock = $('#myReportBlock');
const myReportTitle = $('#myReportTitle');
const formMyReport = $('#formMyReport');
const myReportMsg = $('#myReportMsg');

// ---- Notificaciones (CU-09), reportes de proyectos (CU-14/CU-15) ----
const formNotify = $('#formNotify');
const notifyProyectSelect = $('#notifyProyectSelect');
const notifyMsg = $('#notifyMsg');
const notifyList = $('#notifyList');
const myNotifMsg = $('#myNotifMsg');
const myNotifList = $('#myNotifList');
const proyectStatusFilter = $('#proyectStatusFilter');
const proyectStatusMsg = $('#proyectStatusMsg');
const proyectStatusList = $('#proyectStatusList');
const progressProyectSelect = $('#progressProyectSelect');
const progressMsg = $('#progressMsg');
const progressOverall = $('#progressOverall');
const progressChart = $('#progressChart');

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
const showPersonMsg = msgIn(personMsg);
const showActivityMsg = msgIn(activityMsg);
const showAssignMsg = msgIn(assignMsg);
const showReportMsg = msgIn(reportMsg);
const showMyReportMsg = msgIn(myReportMsg);
const showNotifyMsg = msgIn(notifyMsg);
const showMyNotifMsg = msgIn(myNotifMsg);
const showProyectStatusMsg = msgIn(proyectStatusMsg);
const showProgressMsg = msgIn(progressMsg);

// Rellena un <select> genérico a partir de filas: value = fila[valueKey], texto = labelFn(fila).
// Con `placeholder` antepone una opción vacía (para "elige…" o "sin persona").
function fillSelect(select, rows, valueKey, labelFn, placeholder) {
  select.innerHTML = '';
  if (placeholder != null) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    select.appendChild(opt);
  }
  for (const r of rows) {
    const opt = document.createElement('option');
    opt.value = r[valueKey];
    opt.textContent = labelFn(r);
    select.appendChild(opt);
  }
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

// ---- Pestaña "Asignar perfiles a usuarios" (CU-03) ----
async function loadManageData() {
  const usersRes = await toProcess('User', 'listUsers', ['']);
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

// ---- Pestaña "Asignar permisos" (CU-04): cascada Subsistema → Clase → Método ----
// Se filtra por niveles en vez de listar TODOS los permisos de golpe (evita el "descontrol").
let permMethods = [];   // métodos de la clase elegida, con su estado granted
let permOptions = [];   // opciones (menús) del subsistema elegido, con su estado granted

// Etiqueta legible de una opcion de menu (option_de = id de la pestaña).
function optionLabel(option_de) {
  const tab = TABS.find((t) => t.id === option_de);
  return tab ? tab.label : option_de;
}

async function loadPermData() {
  showPermMsg('');
  const profRes = await toProcess('UserProfile', 'listProfiles', []);
  if (profRes.ok) fillProfileOptions(permProfileSelect, profRes.data.data);

  const subsRes = await toProcess('Permission', 'listSubsystems', []);
  const subs = subsRes.ok ? subsRes.data.data : [];
  const subLabel = (s) => subsystemLabel(s.sub_system_de);
  fillSelect(permSubsystemSelect, subs, 'sub_system_id', subLabel);
  fillSelect(permOptSubsystemSelect, subs, 'sub_system_id', subLabel);

  await loadPermObjects();
  await loadPermOptions();
}

// Métodos — al elegir subsistema se cargan sus clases (objetos); luego los métodos de la clase.
async function loadPermObjects() {
  const sub_id = Number(permSubsystemSelect.value);
  const res = await toProcess('Permission', 'listObjects', [sub_id]);
  fillSelect(permObjectSelect, res.ok ? res.data.data : [], 'object_id', (o) => o.object_de);
  await loadPermMethods();
}

async function loadPermMethods() {
  const object_id = Number(permObjectSelect.value);
  const profile_id = Number(permProfileSelect.value);
  const keep = permMethodSelect.value;   // preserva la selección tras recargar
  permMethods = [];
  if (object_id && profile_id) {
    const res = await toProcess('Permission', 'listMethods', [object_id, profile_id]);
    if (res.ok) permMethods = res.data.data;
    else showPermMsg(res.data.msg || 'Error.', false);
  }
  fillSelect(permMethodSelect, permMethods, 'method_id', (m) => `${m.granted ? '✓' : '○'} ${m.method_de}`);
  if (keep) permMethodSelect.value = keep;
  renderMethodState();
}

// Muestra el estado del método elegido y habilita solo el botón que aplica.
function renderMethodState() {
  const m = permMethods.find((x) => x.method_id === Number(permMethodSelect.value));
  const granted = !!(m && m.granted);
  permMethodState.textContent = m ? (granted ? 'Estado: asignado' : 'Estado: sin asignar') : '';
  permMethodState.className = 'state-tag ' + (granted ? 'on' : 'off');
  $('#btnGrantMethod').disabled = !m || granted;
  $('#btnRevokeMethod').disabled = !m || !granted;
}

async function applyMethodPerm(grant) {
  const profile_id = Number(permProfileSelect.value);
  const method_id = Number(permMethodSelect.value);
  if (!profile_id || !method_id) return;
  const r = await toProcess('Permission', grant ? 'grantMethod' : 'revokeMethod', [profile_id, method_id]);
  if (r.ok) { showPermMsg(grant ? 'Método asignado.' : 'Método desasignado.', true); await loadPermMethods(); }
  else showPermMsg(r.data.msg || 'Error.', false);
}

// Opciones (menús) — al elegir subsistema se cargan sus opciones con estado granted.
async function loadPermOptions() {
  const sub_id = Number(permOptSubsystemSelect.value);
  const profile_id = Number(permProfileSelect.value);
  const keep = permOptionSelect.value;
  permOptions = [];
  if (sub_id && profile_id) {
    const res = await toProcess('Permission', 'listOptions', [sub_id, profile_id]);
    if (res.ok) permOptions = res.data.data;
    else showPermMsg(res.data.msg || 'Error.', false);
  }
  fillSelect(permOptionSelect, permOptions, 'option_id', (o) => `${o.granted ? '✓' : '○'} ${optionLabel(o.option_de)}`);
  if (keep) permOptionSelect.value = keep;
  renderOptionState();
}

function renderOptionState() {
  const o = permOptions.find((x) => x.option_id === Number(permOptionSelect.value));
  const granted = !!(o && o.granted);
  permOptionState.textContent = o ? (granted ? 'Estado: visible' : 'Estado: oculto') : '';
  permOptionState.className = 'state-tag ' + (granted ? 'on' : 'off');
  $('#btnGrantOption').disabled = !o || granted;
  $('#btnRevokeOption').disabled = !o || !granted;
}

async function applyOptionPerm(grant) {
  const profile_id = Number(permProfileSelect.value);
  const option_id = Number(permOptionSelect.value);
  if (!profile_id || !option_id) return;
  const r = await toProcess('Permission', grant ? 'grantOption' : 'revokeOption', [profile_id, option_id]);
  if (!r.ok) { showPermMsg(r.data.msg || 'Error.', false); return; }
  showPermMsg(grant ? 'Menú asignado.' : 'Menú desasignado.', true);
  await loadPermOptions();
  // Si toqué mis propios menús, refresco sesión + pestañas sin recargar la página.
  if (profile_id === currentSession.profile_id) {
    const me = await api('/me');
    if (me.ok && me.data.objectSession) { currentSession = me.data.objectSession; buildTabs(currentSession); }
  }
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

// ---- Pestaña "Auditoría" (CU-05): últimos 500, con filtro opcional por rango de fechas ----
async function loadAuditData() {
  showAuditMsg('');
  auditList.innerHTML = '';
  // El servidor interpreta cadenas vacías como "sin límite" por ese lado del rango.
  const params = { dateFrom: auditFrom.value || null, dateTo: auditTo.value || null, limit: 500 };
  const res = await toProcess('Audit', 'listAudit', params);
  if (!res.ok) {
    showAuditMsg(res.data.msg || 'No tienes permiso para ver la auditoría.', false);
    return;
  }
  const rows = res.data.data || [];
  if (rows.length) showAuditMsg(`${rows.length} movimiento(s).`, true);
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

// ---- Pestaña "Gestión de actividades" (CU-08/CU-09/CU-11, subsistema proyectos) ----
let currentActivity = null; // actividad seleccionada para asignar o ver reportes

async function loadActivityData() {
  showActivityMsg('');
  showAssignMsg('');
  showReportMsg('');
  currentActivity = null;
  activityAssignBlock.classList.add('hidden');
  activityReportBlock.classList.add('hidden');
  resetActivityForm();

  // Cargar proyectos en los selectores
  const proyects = await toProcess('Proyect', 'listProyects', [], 'proyectos');
  if (proyects.ok) {
    const activeProyects = proyects.data.data.filter(p => p.status_id === 1);
    fillSelect(activityProyectSelect, activeProyects, 'id', (p) => `#${p.id} · ${p.name}`, '— Selecciona un proyecto —');
    fillSelect(activityFilterProyect, proyects.data.data, 'id', (p) => `#${p.id} · ${p.name}`, '— Todos los proyectos —');
  }

  // Cargar personas para asignar
  const persons = await toProcess('Proyect', 'listPersons', [], 'proyectos');
  if (persons.ok) {
    fillSelect(activityPersonSelect, persons.data.data, 'person_id',
      (p) => `${p.person_na} ${p.person_ln} · ${p.charge_de}`, '— Selecciona una persona —');
  }

  // Mostrar actividades (todas o filtrar si hay proyecto seleccionado)
  await refreshActivityList();
}

async function refreshActivityList() {
  activityList.innerHTML = '';
  const proyect_id = activityFilterProyect.value;
  
  if (!proyect_id) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Selecciona un proyecto y pulsa "Ver actividades".';
    activityList.appendChild(empty);
    return;
  }

  const res = await toProcess('Activity', 'listActivities', [Number(proyect_id)], 'proyectos');
  if (!res.ok) {
    showActivityMsg(res.data.msg || 'Error al listar actividades.', false);
    return;
  }

  const rows = res.data.data || [];
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Este proyecto no tiene actividades aún.';
    activityList.appendChild(empty);
    return;
  }

  for (const a of rows) {
    const item = document.createElement('div');
    item.className = 'item';

    const left = document.createElement('span');
    left.textContent = `#${a.id} · ${a.name}`;
    const sub = document.createElement('span');
    sub.className = 'item-sub';
    
    const porcentaje = a.last_percentage ? `${a.last_percentage}%` : 'Sin avance';
    const completado = a.completed ? ' ✓ Completado' : '';
    sub.textContent = `${a.hours}h · ${a.assigned_to} · ${porcentaje}${completado} · ${a.status_de}`;
    left.appendChild(sub);

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const STATUS_ACTIVO = 1;
    const badge = document.createElement('span');
    badge.className = 'status-badge ' + (a.status_id === STATUS_ACTIVO ? 'on' : 'off');
    badge.textContent = a.status_de;
    actions.appendChild(badge);

    if (a.status_id === STATUS_ACTIVO) {
      actions.appendChild(miniButton('Editar', () => startEditActivity(a)));
      actions.appendChild(miniButton('Asignar', () => selectActivityForAssign(a)));
    }
    actions.appendChild(miniButton('Reportes', () => selectActivityForReports(a)));

    item.appendChild(left);
    item.appendChild(actions);
    activityList.appendChild(item);
  }
}

// Deja el formulario en modo "crear".
function resetActivityForm() {
  formActivity.reset();
  activityIdField.value = '';
  activityFormTitle.textContent = 'Crear actividad';
  btnSaveActivity.textContent = 'Crear actividad';
  btnCancelActivity.classList.add('hidden');
  activityProyectSelect.disabled = false;
}

// Carga una actividad en el formulario para editarla (mismo form, modo edición).
function startEditActivity(a) {
  activityIdField.value = a.id;
  activityProyectSelect.value = String(a.proyect_id);
  activityProyectSelect.disabled = true;   // la actividad no cambia de proyecto
  formActivity.elements.activity_name.value = a.name;
  formActivity.elements.activity_description.value = a.description || '';
  formActivity.elements.activity_hours.value = a.hours;
  activityFormTitle.textContent = `Editar «${a.name}»`;
  btnSaveActivity.textContent = 'Guardar cambios';
  btnCancelActivity.classList.remove('hidden');
  showActivityMsg('');
  const box = activityList.closest('.tab-content');
  if (box && box.scrollTo) box.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectActivityForAssign(a) {
  currentActivity = a;
  activityAssignTitle.textContent = `Asignar personas a «${a.name}»`;
  activityAssignBlock.classList.remove('hidden');
  activityReportBlock.classList.add('hidden');
  showAssignMsg('');
  refreshAssigneeList();
}

// Lista las personas ya asignadas a la actividad actual, con opción de quitarlas.
async function refreshAssigneeList() {
  assigneeList.innerHTML = '';
  if (!currentActivity) return;
  const res = await toProcess('Activity', 'listActivityAssignees', [currentActivity.id], 'proyectos');
  if (!res.ok) return;
  const rows = res.data.data || [];
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Aún no hay personas asignadas a esta actividad.';
    assigneeList.appendChild(empty);
    return;
  }
  for (const p of rows) {
    const item = document.createElement('div');
    item.className = 'item';
    const left = document.createElement('span');
    left.textContent = `${p.person_na} ${p.person_ln} · ${p.charge_de}`;
    const actions = document.createElement('span');
    actions.className = 'row-actions';
    actions.appendChild(miniButton('Quitar', async () => {
      const r = await toProcess('Activity', 'removeActivityAssignee', [p.id], 'proyectos');
      showAssignMsg(r.ok ? 'Persona quitada de la actividad.' : (r.data.msg || 'Error.'), r.ok);
      if (r.ok) { refreshAssigneeList(); refreshActivityList(); }
    }, true));
    item.appendChild(left);
    item.appendChild(actions);
    assigneeList.appendChild(item);
  }
}

async function selectActivityForReports(a) {
  currentActivity = a;
  activityReportTitle.textContent = `Reportes de «${a.name}»`;
  activityReportBlock.classList.remove('hidden');
  activityAssignBlock.classList.add('hidden');
  showReportMsg('');
  formLeaderReport.reset();
  // El selector de persona para el reporte = las personas asignadas a la actividad.
  const res = await toProcess('Activity', 'listActivityAssignees', [a.id], 'proyectos');
  const assignees = res.ok ? res.data.data : [];
  fillSelect(leaderReportPerson, assignees, 'person_id', (p) => `${p.person_na} ${p.person_ln}`);
  // Sin personas asignadas no se puede reportar: se oculta el formulario.
  formLeaderReport.classList.toggle('hidden', assignees.length === 0);
  if (!assignees.length) showReportMsg('Asigna al menos una persona para poder registrar avances.', false);
  refreshReportList();
}

async function refreshReportList() {
  reportList.innerHTML = '';
  if (!currentActivity) return;

  const res = await toProcess('Activity', 'listReports', [currentActivity.id], 'proyectos');
  if (!res.ok) {
    showReportMsg(res.data.msg || 'Error al listar reportes.', false);
    return;
  }

  const rows = res.data.data || [];
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No hay reportes aún para esta actividad.';
    reportList.appendChild(empty);
    return;
  }

  for (const r of rows) {
    const item = document.createElement('div');
    item.className = 'item';

    const left = document.createElement('span');
    const porcentaje = document.createElement('b');
    porcentaje.textContent = `${r.percentage}%`;
    left.appendChild(porcentaje);
    left.append(` · ${r.person_na} ${r.person_ln}`);
    
    if (r.completed) {
      const badge = document.createElement('span');
      badge.className = 'tag';
      badge.textContent = 'Completado';
      left.appendChild(badge);
    }

    const sub = document.createElement('span');
    sub.className = 'item-sub';
    sub.textContent = `${r.created_at} · ${r.description}`;
    left.appendChild(sub);

    item.appendChild(left);
    reportList.appendChild(item);
  }
}

// ---- Pestaña "Mis actividades" (empleado) ----
let myCurrentActivity = null;

async function loadMyActivities() {
  showMyReportMsg('');
  myReportBlock.classList.add('hidden');
  myCurrentActivity = null;
  await refreshMyActivitiesList();
}

async function refreshMyActivitiesList() {
  myActivitiesList.innerHTML = '';

  // El person_id viene en la sesión (person_user). El empleado NO puede listar todas las
  // personas (eso es del admin); por eso usamos su propia persona ya resuelta en el login.
  const myPersonId = currentSession.person_id;
  if (!myPersonId) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No tienes una persona vinculada a tu cuenta. Contacta al administrador.';
    myActivitiesList.appendChild(empty);
    return;
  }

  const res = await toProcess('Activity', 'getMyActivities', [myPersonId], 'proyectos');
  if (!res.ok) {
    showMyReportMsg(res.data.msg || 'Error al listar tus actividades.', false);
    return;
  }

  const rows = res.data.data || [];
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No tienes actividades asignadas.';
    myActivitiesList.appendChild(empty);
    return;
  }

  for (const a of rows) {
    const item = document.createElement('div');
    item.className = 'item';

    const left = document.createElement('span');
    left.textContent = `#${a.id} · ${a.name}`;
    const sub = document.createElement('span');
    sub.className = 'item-sub';
    sub.textContent = `Proyecto: ${a.proyect_name} · ${a.hours}h`;
    left.appendChild(sub);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    
    const STATUS_ACTIVO = 1;
    const badge = document.createElement('span');
    badge.className = 'status-badge ' + (a.status_id === STATUS_ACTIVO ? 'on' : 'off');
    badge.textContent = a.status_id === STATUS_ACTIVO ? 'Activo' : 'Culminado';
    actions.appendChild(badge);

    if (a.status_id === STATUS_ACTIVO) {
      actions.appendChild(miniButton('Reportar', () => selectMyActivity(a)));
    }

    item.appendChild(left);
    item.appendChild(actions);
    myActivitiesList.appendChild(item);
  }
}

function selectMyActivity(a) {
  myCurrentActivity = a;
  myReportTitle.textContent = `Reportar avance en «${a.name}»`;
  myReportBlock.classList.remove('hidden');
  formMyReport.reset();
  showMyReportMsg('');
}

// ---- Pestaña "Mantenimiento de usuarios" (CU-02) ----
async function loadUserMgmt() {
  // El formulario de crear cuenta solo se muestra a quien tiene permiso.
  createUserBlock.classList.toggle('hidden', !currentSession.canRegister);
  formRegister.reset();
  showRegisterMsg('');
  await refreshUnlinkedPersons();
  refreshUsersList();
}

// Personas sin cuenta: alimentan el selector "Persona (opcional)" al crear una cuenta.
async function refreshUnlinkedPersons() {
  const res = await toProcess('Person', 'listPersons', ['']);
  const free = res.ok ? res.data.data.filter((p) => !p.linked_user_id) : [];
  fillSelect(registerPersonSelect, free, 'person_id',
    (p) => `${p.person_na} ${p.person_ln} · ${p.person_ci}`, '— Sin persona —');
}

async function refreshUsersList() {
  showUsersMsg('');
  usersList.innerHTML = '';
  const res = await toProcess('User', 'listUsers', [userSearch.value.trim()]);
  if (!res.ok) { showUsersMsg(res.data.msg || 'No tienes permiso para listar usuarios.', false); return; }
  const rows = res.data.data;
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Sin usuarios que coincidan.';
    usersList.appendChild(empty);
    return;
  }
  for (const u of rows) {
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
    // Línea secundaria: persona vinculada (o aviso de que no tiene).
    const sub = document.createElement('span');
    sub.className = 'item-sub';
    sub.textContent = u.person_id ? `Persona: ${u.person_name} · ${u.person_ci}` : 'Sin persona vinculada';
    info.appendChild(sub);

    const right = document.createElement('span');
    right.className = 'row-actions';

    const active = u.status_id === 1;
    const badge = document.createElement('span');
    badge.className = 'status-badge ' + (active ? 'on' : 'off');
    badge.textContent = u.status_de;
    right.appendChild(badge);

    // Vincular/desvincular persona (solo con permiso de crear cuentas = admin).
    if (currentSession.canRegister) {
      if (u.person_id) {
        right.appendChild(miniButton('Desvincular', async () => {
          if (!confirm(`¿Quitar el vínculo de persona de "${u.user_na}"?`)) return;
          const r = await toProcess('Person', 'unlinkPersonUser', [u.user_id]);
          showUsersMsg(r.ok ? 'Vínculo quitado.' : (r.data.msg || 'Error.'), r.ok);
          if (r.ok) { refreshUnlinkedPersons(); refreshUsersList(); }
        }, true));
      } else {
        right.appendChild(miniButton('Vincular', () => linkPersonToUser(u)));
      }
    }

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

// Vincular una persona (sin cuenta) a una cuenta existente, vía prompt de selección simple.
async function linkPersonToUser(u) {
  const res = await toProcess('Person', 'listPersons', ['']);
  const free = res.ok ? res.data.data.filter((p) => !p.linked_user_id) : [];
  if (!free.length) { showUsersMsg('No hay personas libres para vincular. Registra una primero.', false); return; }
  const lista = free.map((p, i) => `${i + 1}) ${p.person_na} ${p.person_ln} · ${p.person_ci}`).join('\n');
  const elegido = prompt(`Vincular persona a "${u.user_na}". Escribe el número:\n\n${lista}`);
  if (elegido == null) return;
  const idx = Number(elegido) - 1;
  if (!(idx >= 0 && idx < free.length)) { showUsersMsg('Selección no válida.', false); return; }
  const r = await toProcess('Person', 'linkPersonUser', [free[idx].person_id, u.user_id]);
  showUsersMsg(r.ok ? 'Persona vinculada.' : (r.data.msg || 'Error.'), r.ok);
  if (r.ok) { refreshUnlinkedPersons(); refreshUsersList(); }
}

// ---- Pestaña "Mantenimiento de personas" (nómina): crear/buscar/editar ----
async function loadPersonData() {
  showPersonMsg('');
  resetPersonForm();
  const ch = await toProcess('Person', 'listCharges', []);
  fillSelect(personChargeSelect, ch.ok ? ch.data.data : [], 'id', (c) => c.name, '— Sin cargo —');
  refreshPersonList();
}

function resetPersonForm() {
  formPerson.reset();
  personIdField.value = '';
  personFormTitle.textContent = 'Registrar persona';
  btnSavePerson.textContent = 'Registrar';
  btnCancelPerson.classList.add('hidden');
}

async function refreshPersonList() {
  personList.innerHTML = '';
  const res = await toProcess('Person', 'listPersons', [personSearch.value.trim()]);
  if (!res.ok) { showPersonMsg(res.data.msg || 'No tienes permiso para ver personas.', false); return; }
  const rows = res.data.data;
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Sin personas que coincidan.';
    personList.appendChild(empty);
    return;
  }
  for (const p of rows) {
    const item = document.createElement('div');
    item.className = 'item';

    const info = document.createElement('span');
    const name = document.createElement('b');
    name.textContent = `${p.person_na} ${p.person_ln}`;
    info.append(name);
    const sub = document.createElement('span');
    sub.className = 'item-sub';
    sub.textContent = `CI ${p.person_ci} · ${p.charge_de} · ${p.person_mail} · ${p.person_phone}` +
      (p.linked_user ? ` · cuenta: ${p.linked_user}` : ' · sin cuenta');
    info.appendChild(sub);

    const actions = document.createElement('span');
    actions.className = 'row-actions';
    actions.appendChild(miniButton('Editar', () => startEditPerson(p)));

    item.appendChild(info);
    item.appendChild(actions);
    personList.appendChild(item);
  }
}

// Carga una persona en el formulario para editarla (mismo form, modo edición).
function startEditPerson(p) {
  personIdField.value = p.person_id;
  formPerson.elements.person_ci.value = p.person_ci;
  formPerson.elements.person_na.value = p.person_na;
  formPerson.elements.person_ln.value = p.person_ln;
  formPerson.elements.person_mail.value = p.person_mail === '—' ? '' : p.person_mail;
  formPerson.elements.person_phone.value = p.person_phone === '—' ? '' : p.person_phone;
  personChargeSelect.value = p.charge_id || '';
  personFormTitle.textContent = `Editar a ${p.person_na} ${p.person_ln}`;
  btnSavePerson.textContent = 'Guardar cambios';
  btnCancelPerson.classList.remove('hidden');
  showPersonMsg('');
  // Sube al formulario (arriba del panel con scroll) para no editar "a ciegas".
  const box = personList.closest('.tab-content');
  if (box && box.scrollTo) box.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- Pestaña "Notificar al equipo" (CU-09, líder) ----
async function loadNotifyData() {
  showNotifyMsg('');
  const proyects = await toProcess('Proyect', 'listProyects', [], 'proyectos');
  fillSelect(notifyProyectSelect, proyects.ok ? proyects.data.data : [], 'id', (p) => `#${p.id} · ${p.name}`);
  await refreshNotifyList();
}

async function refreshNotifyList() {
  notifyList.innerHTML = '';
  const proyect_id = Number(notifyProyectSelect.value);
  if (!proyect_id) return;
  const res = await toProcess('Notification', 'listProyectNotifications', [proyect_id], 'proyectos');
  if (!res.ok) { showNotifyMsg(res.data.msg || 'Error.', false); return; }
  renderNotifItems(notifyList, res.data.data, false);
}

// ---- Pestaña "Mis notificaciones" (CU-09, empleado) ----
async function loadMyNotif() {
  showMyNotifMsg('');
  myNotifList.innerHTML = '';
  if (!currentSession.person_id) { showMyNotifMsg('No tienes una persona vinculada a tu cuenta.', false); return; }
  const res = await toProcess('Notification', 'getMyNotifications', [currentSession.person_id], 'proyectos');
  if (!res.ok) { showMyNotifMsg(res.data.msg || 'Error.', false); return; }
  renderNotifItems(myNotifList, res.data.data, true);
}

// Pinta una lista de notificaciones (con o sin el nombre del proyecto).
function renderNotifItems(container, rows, showProyect) {
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No hay notificaciones.';
    container.appendChild(empty);
    return;
  }
  for (const n of rows) {
    const item = document.createElement('div');
    item.className = 'item notif-item';
    const meta = document.createElement('div');
    meta.className = 'notif-meta';
    meta.textContent = `${n.created_at} · ${n.sender}` + (showProyect ? ` · ${n.proyect_name}` : '');
    const body = document.createElement('div');
    body.className = 'notif-body';
    body.textContent = n.message;
    item.appendChild(meta);
    item.appendChild(body);
    container.appendChild(item);
  }
}

// ---- Pestaña "Proyectos activos/culminados" (CU-15, líder) ----
async function loadProyectStatus() {
  showProyectStatusMsg('');
  await refreshProyectStatusList();
}

async function refreshProyectStatusList() {
  proyectStatusList.innerHTML = '';
  const res = await toProcess('Proyect', 'listProyects', [], 'proyectos');
  if (!res.ok) { showProyectStatusMsg(res.data.msg || 'Error.', false); return; }
  const filter = proyectStatusFilter.value;
  let rows = res.data.data;
  if (filter !== 'all') rows = rows.filter((p) => String(p.status_id) === filter);
  const activos = rows.filter((p) => p.status_id === 1);
  const culminados = rows.filter((p) => p.status_id === 3);
  showProyectStatusMsg(`${activos.length} activo(s) · ${culminados.length} culminado(s)`, true);
  renderProyectGroup('Activos', activos);
  renderProyectGroup('Culminados', culminados);
}

function renderProyectGroup(title, rows) {
  if (!rows.length) return;
  const head = document.createElement('div');
  head.className = 'group-head';
  head.textContent = `${title} (${rows.length})`;
  proyectStatusList.appendChild(head);
  for (const p of rows) {
    const item = document.createElement('div');
    item.className = 'item';
    const left = document.createElement('span');
    left.textContent = `#${p.id} · ${p.name}`;
    const sub = document.createElement('span');
    sub.className = 'item-sub';
    sub.textContent = `Líder: ${p.leader_na} · ${p.members} miembro(s)`;
    left.appendChild(sub);
    const badge = document.createElement('span');
    badge.className = 'status-badge ' + (p.status_id === 1 ? 'on' : 'off');
    badge.textContent = p.status_de;
    item.appendChild(left);
    item.appendChild(badge);
    proyectStatusList.appendChild(item);
  }
}

// ---- Pestaña "Gráficas de avance" (CU-14, líder) ----
async function loadProgress() {
  showProgressMsg('');
  progressChart.innerHTML = '';
  progressOverall.innerHTML = '';
  const proyects = await toProcess('Proyect', 'listProyects', [], 'proyectos');
  fillSelect(progressProyectSelect, proyects.ok ? proyects.data.data : [], 'id', (p) => `#${p.id} · ${p.name}`);
  await renderProgress();
}

// Avance de una actividad = 100 si está completada, si no su último % reportado (50-100),
// o 0 si aún no tiene reporte. El avance del proyecto es el promedio de sus actividades.
function activityProgress(a) {
  if (a.completed) return 100;
  if (a.last_percentage != null) return Number(a.last_percentage);
  return 0;
}

async function renderProgress() {
  progressChart.innerHTML = '';
  progressOverall.innerHTML = '';
  const proyect_id = Number(progressProyectSelect.value);
  if (!proyect_id) return;
  const res = await toProcess('Activity', 'listActivities', [proyect_id], 'proyectos');
  if (!res.ok) { showProgressMsg(res.data.msg || 'Error.', false); return; }
  const acts = res.data.data;
  if (!acts.length) { showProgressMsg('Este proyecto no tiene actividades.', false); return; }
  showProgressMsg('');

  const overallPct = Math.round(acts.reduce((sum, a) => sum + activityProgress(a), 0) / acts.length);
  const ov = document.createElement('div');
  ov.className = 'overall';
  const num = document.createElement('div');
  num.className = 'overall-num';
  num.textContent = `${overallPct}%`;
  const txt = document.createElement('div');
  txt.className = 'overall-txt';
  const done = acts.filter((a) => activityProgress(a) >= 100).length;
  txt.textContent = `Avance general del proyecto · ${done}/${acts.length} actividad(es) completada(s)`;
  ov.appendChild(num);
  ov.appendChild(txt);
  progressOverall.appendChild(ov);

  for (const a of acts) {
    const pct = activityProgress(a);
    const row = document.createElement('div');
    row.className = 'bar-row';
    const label = document.createElement('div');
    label.className = 'bar-label';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = a.name;
    const pctSpan = document.createElement('span');
    pctSpan.className = 'bar-pct';
    pctSpan.textContent = pct === 0 ? 'Sin iniciar' : `${pct}%`;
    label.appendChild(nameSpan);
    label.appendChild(pctSpan);
    const track = document.createElement('div');
    track.className = 'bar-track';
    const fill = document.createElement('div');
    fill.className = 'bar-fill' + (pct >= 100 ? ' done' : pct === 0 ? ' none' : '');
    fill.style.width = Math.max(pct, 2) + '%';
    track.appendChild(fill);
    row.appendChild(label);
    row.appendChild(track);
    progressChart.appendChild(row);
  }
}

// Definicion de pestañas: etiqueta, permiso que las habilita, y carga de datos al abrir.
// Cada pestaña corresponde a una OPCION de menu (option_de = id de la pestaña). Su
// visibilidad la decide permission_option (session.visibleOptions); las acciones de adentro
// se siguen validando por metodo en el servidor.
// "sub" = subsistema dueño de la pestaña: en la ventana de un subsistema solo se
// muestran SUS opciones (aunque el perfil tenga opciones de otros subsistemas).
const TABS = [
  { id: 'userMgmtBox',     label: 'Mantenimiento de usuarios',   load: loadUserMgmt,      sub: 'security' },
  { id: 'personMgmtBox',   label: 'Mantenimiento de personas',   load: loadPersonData,    sub: 'security' },
  { id: 'profileBox',      label: 'Mantenimiento de perfiles',   load: loadProfileCrud,   sub: 'security' },
  { id: 'manageBox',       label: 'Asignar perfiles a usuarios', load: loadManageData,    sub: 'security' },
  { id: 'permBox',         label: 'Asignar permisos',            load: loadPermData,      sub: 'security' },
  { id: 'auditBox',        label: 'Auditoría',                   load: loadAuditData,     sub: 'security' },
  { id: 'proyectMgmtBox',  label: 'Mantenimiento de proyectos',  load: loadProyectData,   sub: 'proyectos' },
  { id: 'activityMgmtBox', label: 'Gestión de actividades',      load: loadActivityData,  sub: 'proyectos' },
  { id: 'notifyBox',       label: 'Notificar al equipo',         load: loadNotifyData,    sub: 'proyectos' },
  { id: 'proyectStatusBox',label: 'Proyectos activos/culminados',load: loadProyectStatus, sub: 'proyectos' },
  { id: 'progressBox',     label: 'Gráficas de avance',          load: loadProgress,      sub: 'proyectos' },
  { id: 'myActivitiesBox', label: 'Mis actividades',             load: loadMyActivities,  sub: 'proyectos' },
  { id: 'myNotifBox',      label: 'Mis notificaciones',          load: loadMyNotif,       sub: 'proyectos' }
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
  const { ok, status, data } = await api('/selectProfile', {
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
  } else if (status === 401) {
    // La sesion ya no existe en el servidor (cada npm start borra las sesiones en
    // memoria): quedarse en el workspace seria engañoso -> volver al login.
    renderLoggedOut();
    showMsg('Tu sesión expiró. Inicia sesión de nuevo.', false);
  } else {
    // Error sin cambio de pantalla: reponer el selector al perfil realmente activo.
    profileSwitchSelect.value = String(currentSession.profile_id);
    showMsg(data.msg || 'No se pudo cambiar de perfil.', false);
  }
});

formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(formRegister);
  const body = { user_na: fd.get('user_na'), user_pw: fd.get('user_pw') };
  // Persona opcional: solo se envía si se eligió una en el selector.
  if (registerPersonSelect.value) body.person_id = Number(registerPersonSelect.value);
  const { ok, data } = await toProcess('User', 'insertUser', body);
  if (ok) {
    formRegister.reset();
    showRegisterMsg('Usuario creado.', true);
    refreshUnlinkedPersons();
    refreshUsersList();
  } else if (data.errors && data.errors.length) {
    showRegisterMsg('• ' + data.errors.join('\n• '), false);
  } else {
    showRegisterMsg(data.msg, false);
  }
});

// Búsqueda de usuarios (por usuario, nombre o cédula) con debounce.
let userSearchTimer = null;
userSearch.addEventListener('input', () => {
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(refreshUsersList, 250);
});

// ---- Mantenimiento de personas ----
formPerson.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(formPerson);
  const body = {
    person_ci: fd.get('person_ci'),
    person_na: fd.get('person_na'),
    person_ln: fd.get('person_ln'),
    person_mail: fd.get('person_mail'),
    person_phone: fd.get('person_phone'),
    charge_id: personChargeSelect.value ? Number(personChargeSelect.value) : null
  };
  const editId = personIdField.value;
  const method = editId ? 'updatePerson' : 'insertPerson';
  if (editId) body.person_id = Number(editId);
  const { ok, data } = await toProcess('Person', method, body);
  if (ok) {
    showPersonMsg(editId ? 'Persona actualizada.' : 'Persona registrada.', true);
    resetPersonForm();
    refreshPersonList();
    refreshUnlinkedPersons();
  } else if (data.errors && data.errors.length) {
    showPersonMsg('• ' + data.errors.join('\n• '), false);
  } else {
    showPersonMsg(data.msg || 'Error.', false);
  }
});

btnCancelPerson.addEventListener('click', () => { resetPersonForm(); showPersonMsg(''); });

let personSearchTimer = null;
personSearch.addEventListener('input', () => {
  clearTimeout(personSearchTimer);
  personSearchTimer = setTimeout(refreshPersonList, 250);
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

// ---- Actividades: crear ----
formActivity.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(formActivity);
  const editId = activityIdField.value;
  const base = {
    name: (fd.get('activity_name') || '').trim(),
    description: (fd.get('activity_description') || '').trim(),
    hours: parseInt(fd.get('activity_hours'))
  };
  const method = editId ? 'updateActivity' : 'insertActivity';
  const body = editId ? { activity_id: Number(editId), ...base } : { proyect_id: Number(activityProyectSelect.value), ...base };
  const { ok, data } = await toProcess('Activity', method, body, 'proyectos');
  if (ok) {
    resetActivityForm();
    showActivityMsg(editId ? 'Actividad actualizada.' : 'Actividad creada.', true);
    refreshActivityList();
  } else if (data.errors && data.errors.length) {
    showActivityMsg('• ' + data.errors.join('\n• '), false);
  } else {
    showActivityMsg(data.msg || 'Error.', false);
  }
});

$('#btnCancelActivity').addEventListener('click', () => { resetActivityForm(); showActivityMsg(''); });

// ---- Actividades: filtrar por proyecto ----
$('#btnFilterActivities').addEventListener('click', () => {
  showActivityMsg('');
  refreshActivityList();
});

// ---- Actividades: asignar persona ----
$('#btnAssignActivity').addEventListener('click', async () => {
  if (!currentActivity) return;
  const person_id = Number(activityPersonSelect.value);
  if (!person_id) { showAssignMsg('Selecciona una persona.', false); return; }
  const { ok, data } = await toProcess('Activity', 'assignActivity', [currentActivity.id, person_id], 'proyectos');
  showAssignMsg(ok ? 'Persona asignada.' : (data.msg || 'Error.'), ok);
  // El bloque queda abierto para poder asignar MÁS personas; se refresca la lista de asignados.
  if (ok) { refreshAssigneeList(); refreshActivityList(); }
});

$('#btnCancelAssign').addEventListener('click', () => {
  activityAssignBlock.classList.add('hidden');
  currentActivity = null;
  showAssignMsg('');
});

// El líder registra el avance de una persona asignada (CU-11 también lo hace el propio
// empleado desde "Mis actividades"). Reutiliza insertReport (valida el 50%-100%).
formLeaderReport.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentActivity) return;
  const person_id = Number(leaderReportPerson.value);
  if (!person_id) { showReportMsg('Selecciona la persona del avance.', false); return; }
  const fd = new FormData(formLeaderReport);
  const body = {
    activity_id: currentActivity.id,
    person_id,
    percentage: parseInt(fd.get('lr_percentage')),
    description: (fd.get('lr_description') || '').trim()
  };
  const { ok, data } = await toProcess('Activity', 'insertReport', body, 'proyectos');
  if (ok) {
    formLeaderReport.reset();
    showReportMsg('Avance registrado.' + (data.data && data.data.completed ? ' ¡Actividad completada!' : ''), true);
    refreshReportList();
    refreshActivityList();
  } else if (data.errors && data.errors.length) {
    showReportMsg('• ' + data.errors.join('\n• '), false);
  } else {
    showReportMsg(data.msg || 'Error.', false);
  }
});

$('#btnCloseReports').addEventListener('click', () => {
  activityReportBlock.classList.add('hidden');
  currentActivity = null;
  showReportMsg('');
});

// ---- Mis actividades: reportar avance (empleado) ----
formMyReport.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!myCurrentActivity) return;
  if (!currentSession.person_id) { showMyReportMsg('No se encontró tu persona vinculada.', false); return; }

  const fd = new FormData(formMyReport);
  const body = {
    activity_id: myCurrentActivity.id,
    person_id: currentSession.person_id,
    percentage: parseInt(fd.get('my_report_percentage')),
    description: fd.get('my_report_description').trim()
  };
  const { ok, data } = await toProcess('Activity', 'insertReport', body, 'proyectos');
  if (ok) {
    formMyReport.reset();
    showMyReportMsg('Reporte registrado.' + (data.data && data.data.completed ? ' ¡Actividad completada!' : ''), true);
    myReportBlock.classList.add('hidden');
    refreshMyActivitiesList();
  } else if (data.errors && data.errors.length) {
    showMyReportMsg('• ' + data.errors.join('\n• '), false);
  } else {
    showMyReportMsg(data.msg || 'Error.', false);
  }
});

$('#btnCancelMyReport').addEventListener('click', () => {
  myReportBlock.classList.add('hidden');
  myCurrentActivity = null;
  showMyReportMsg('');
});

// ---- Notificar al equipo (CU-09, líder) ----
formNotify.addEventListener('submit', async (e) => {
  e.preventDefault();
  const proyect_id = Number(notifyProyectSelect.value);
  const message = new FormData(formNotify).get('message');
  const { ok, data } = await toProcess('Notification', 'sendNotification', { proyect_id, message }, 'proyectos');
  if (ok) {
    formNotify.reset();
    showNotifyMsg('Notificación enviada al equipo.', true);
    refreshNotifyList();
  } else if (data.errors && data.errors.length) {
    showNotifyMsg('• ' + data.errors.join('\n• '), false);
  } else {
    showNotifyMsg(data.msg || 'Error.', false);
  }
});
notifyProyectSelect.addEventListener('change', refreshNotifyList);

// ---- Reportes de proyectos (CU-14 / CU-15, líder) ----
proyectStatusFilter.addEventListener('change', refreshProyectStatusList);
$('#btnLoadProgress').addEventListener('click', renderProgress);
progressProyectSelect.addEventListener('change', renderProgress);

// ---- Cascada de "Asignar permisos" ----
// Cambiar de perfil recarga métodos y opciones (con el nuevo estado granted).
permProfileSelect.addEventListener('change', () => { loadPermMethods(); loadPermOptions(); });
permSubsystemSelect.addEventListener('change', loadPermObjects);
permObjectSelect.addEventListener('change', loadPermMethods);
permMethodSelect.addEventListener('change', renderMethodState);
$('#btnGrantMethod').addEventListener('click', () => applyMethodPerm(true));
$('#btnRevokeMethod').addEventListener('click', () => applyMethodPerm(false));
permOptSubsystemSelect.addEventListener('change', loadPermOptions);
permOptionSelect.addEventListener('change', renderOptionState);
$('#btnGrantOption').addEventListener('click', () => applyOptionPerm(true));
$('#btnRevokeOption').addEventListener('click', () => applyOptionPerm(false));

// ---- Filtros de auditoría ----
$('#btnAuditFilter').addEventListener('click', loadAuditData);
$('#btnAuditClear').addEventListener('click', () => { auditFrom.value = ''; auditTo.value = ''; loadAuditData(); });

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
