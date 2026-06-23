const $ = (sel) => document.querySelector(sel);

const formLogin = $('#formLogin');
const formRegister = $('#formRegister');
const registerBox = $('#registerBox');
const registerMsg = $('#registerMsg');
const profileSelect = $('#profileSelect');
const profileButtons = $('#profileButtons');
const panel = $('#panel');
const msg = $('#msg');
const title = document.querySelector('h1');
const whoami = $('#whoami');
const resultMsg = $('#resultMsg');
const resultList = $('#resultList');
const manageBox = $('#manageBox');
const userSelect = $('#userSelect');
const profileAssignSelect = $('#profileAssignSelect');
const manageMsg = $('#manageMsg');
const userProfilesList = $('#userProfilesList');
const permBox = $('#permBox');
const permProfileSelect = $('#permProfileSelect');
const permMsg = $('#permMsg');
const permList = $('#permList');

function showMsg(text, ok = true) {
  msg.textContent = text || '';
  msg.className = 'msg ' + (ok ? 'ok' : 'error');
}

function showRegisterMsg(text, ok = true) {
  registerMsg.textContent = text || '';
  registerMsg.className = 'msg ' + (ok ? 'ok' : 'error');
}

function showResultMsg(text, ok = true) {
  resultMsg.textContent = text || '';
  resultMsg.className = 'msg ' + (ok ? 'ok' : 'error');
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

function showManageMsg(text, ok = true) {
  manageMsg.textContent = text || '';
  manageMsg.className = 'msg ' + (ok ? 'ok' : 'error');
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

// Carga los datos del bloque de admin: lista de usuarios y catalogo de perfiles.
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

// Muestra los perfiles que tiene asignados el usuario seleccionado.
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

function showPermMsg(text, ok = true) {
  permMsg.textContent = text || '';
  permMsg.className = 'msg ' + (ok ? 'ok' : 'error');
}

// CU-04: carga el catalogo de perfiles en el selector y pinta sus permisos.
async function loadPermData() {
  showPermMsg('');
  const profRes = await toProcess('UserProfile', 'listProfiles', []);
  if (profRes.ok) fillProfileOptions(permProfileSelect, profRes.data.data);
  await refreshPermList();
}

// Pinta el catalogo completo de metodos con un boton que refleja si el perfil
// elegido los tiene concedidos (granted). Tocar el boton concede o quita el permiso.
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

// Al elegir otro perfil, recargar sus permisos.
permProfileSelect.addEventListener('change', refreshPermList);

// Habilita o bloquea los campos del formulario de "Crear cuenta".
// Todos ven el bloque, pero solo el admin puede escribir y enviarlo.
function setRegisterEnabled(enabled) {
  for (const field of formRegister.elements) {
    field.disabled = !enabled;
  }
}

// Muestra la pantalla "Perfiles" para que el usuario elija el perfil activo.
function renderProfileSelect(profiles) {
  title.classList.add('hidden');
  formLogin.classList.add('hidden');
  panel.classList.add('hidden');
  msg.classList.add('hidden');
  profileSelect.classList.remove('hidden');
  profileButtons.innerHTML = '';
  for (const p of profiles) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'profile-card';
    btn.textContent = p.profile_de;
    btn.addEventListener('click', async () => {
      const { ok, data } = await api('/selectProfile', {
        method: 'POST',
        body: JSON.stringify({ profile_id: p.profile_id })
      });
      if (ok) {
        profileSelect.classList.add('hidden');
        renderSession(data.objectSession);
      } else {
        msg.classList.remove('hidden');
        showMsg(data.msg || 'No se pudo seleccionar el perfil.', false);
      }
    });
    profileButtons.appendChild(btn);
  }
}

function renderSession(session) {
  title.classList.add('hidden');
  formLogin.classList.add('hidden');
  profileSelect.classList.add('hidden');
  msg.classList.add('hidden');
  panel.classList.remove('hidden');
  whoami.textContent = `Conectado como ${session.user_na} (${session.profile_de})`;
  // El bloque se muestra a todos, pero solo se habilita si la BD le concede el permiso.
  const canRegister = !!session.canRegister;
  registerBox.classList.remove('hidden');
  formRegister.reset();
  setRegisterEnabled(canRegister);
  showRegisterMsg(canRegister ? '' : 'No tienes permiso para crear cuentas.', false);
  showResultMsg('');
  resultList.innerHTML = '';

  // Bloque de admin para asignar/quitar perfiles: solo si la BD le concede el permiso.
  manageMsg.textContent = '';
  userProfilesList.innerHTML = '';
  if (session.canManageProfiles) {
    manageBox.classList.remove('hidden');
    loadManageData();
  } else {
    manageBox.classList.add('hidden');
  }

  // CU-04 Gestionar permisos: solo si el perfil activo tiene el permiso.
  permMsg.textContent = '';
  permList.innerHTML = '';
  if (session.canManagePermissions) {
    permBox.classList.remove('hidden');
    loadPermData();
  } else {
    permBox.classList.add('hidden');
  }
}

function renderLoggedOut() {
  panel.classList.add('hidden');
  profileSelect.classList.add('hidden');
  registerBox.classList.add('hidden');
  permBox.classList.add('hidden');
  title.classList.remove('hidden');
  formLogin.classList.remove('hidden');
  msg.classList.remove('hidden');
  showMsg('');
}

formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();
  // Crear cuenta ahora entra por el dispatcher como cualquier otro metodo (insertUser).
  const body = Object.fromEntries(new FormData(formRegister));
  const { ok, data } = await toProcess('User', 'insertUser', body);
  if (ok) {
    formRegister.reset();
    showRegisterMsg('Usuario creado.', true);
  } else if (data.errors && data.errors.length) {
    showRegisterMsg('• ' + data.errors.join('\n• '), false);
  } else {
    showRegisterMsg(data.msg, false);
  }
});

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(formLogin));
  const { ok, data } = await api('/login', { method: 'POST', body: JSON.stringify(body) });
  showMsg(data.msg, ok);
  if (ok) {
    formLogin.reset();
    // ready=true -> entro directo (un solo perfil). ready=false -> pantalla "Perfiles".
    if (data.ready) {
      renderSession(data.objectSession);
    } else {
      renderProfileSelect(data.profiles);
    }
  }
});

// Cancelar la seleccion de perfil = cerrar la sesion a medias y volver al login.
$('#btnCancelProfile').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' });
  renderLoggedOut();
});

$('#btnLogout').addEventListener('click', async () => {
  const { ok, data } = await api('/logout', { method: 'POST' });
  renderLoggedOut();
  showMsg(data.msg, ok);
});

function renderUsers(rows) {
  resultList.innerHTML = '';
  for (const u of rows) {
    const item = document.createElement('div');
    item.className = 'item';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `#${u.user_id} · ${u.user_na}`;
    const profSpan = document.createElement('span');
    profSpan.className = 'tag';
    profSpan.textContent = u.profiles;
    item.appendChild(nameSpan);
    item.appendChild(profSpan);
    resultList.appendChild(item);
  }
}

// j = { subsystem, objectName, methodName, params } -> POST /toProcess
$('#btnListUsers').addEventListener('click', async () => {
  const j = {
    subsystem: 'security',
    objectName: 'User',
    methodName: 'listUsers',
    params: []
  };
  const { ok, data } = await api('/toProcess', { method: 'POST', body: JSON.stringify(j) });
  if (ok) {
    renderUsers(data.data);
    showResultMsg(`Permitido: ${data.data.length} usuario(s).`, true);
  } else {
    resultList.innerHTML = '';
    showResultMsg(data.msg || 'Error.', false);
  }
});

// Al elegir otro usuario, mostrar los perfiles que tiene.
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

// Al recargar la pagina, restaura la sesion si la cookie sigue viva.
// Si quedo a medias (sin perfil elegido), reanuda en la pantalla "Perfiles".
(async () => {
  const { ok, data } = await api('/me');
  if (!ok) return;
  if (data.ready && data.objectSession) {
    renderSession(data.objectSession);
  } else if (data.ready === false && data.profiles) {
    renderProfileSelect(data.profiles);
  }
})();
