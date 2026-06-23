const $ = (sel) => document.querySelector(sel);

const formLogin = $('#formLogin');
const formRegister = $('#formRegister');
const registerBox = $('#registerBox');
const registerMsg = $('#registerMsg');
const panel = $('#panel');
const msg = $('#msg');
const title = document.querySelector('h1');
const whoami = $('#whoami');
const resultMsg = $('#resultMsg');
const resultList = $('#resultList');
const profileSelect = $('#profileSelect');
const switchMsg = $('#switchMsg');
const manageBox = $('#manageBox');
const userSelect = $('#userSelect');
const profileAssignSelect = $('#profileAssignSelect');
const manageMsg = $('#manageMsg');
const userProfilesList = $('#userProfilesList');
const projectsList = $('#projectsList');

function showMsg(text, ok = true) {
  if (!msg) return;
  msg.textContent = text || '';
  msg.className = 'msg ' + (ok ? 'ok' : 'error');
}

function showRegisterMsg(text, ok = true) {
  if (!registerMsg) return;
  registerMsg.textContent = text || '';
  registerMsg.className = 'msg ' + (ok ? 'ok' : 'error');
}

function showResultMsg(text, ok = true) {
  if (!resultMsg) return;
  resultMsg.textContent = text || '';
  resultMsg.className = 'msg ' + (ok ? 'ok' : 'error');
}

// ✅ FUNCIÓN API CORREGIDA: Une el JSON en la raíz para evitar el problema del data.data
async function api(path, options = {}) {
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch (error) {
    console.error("Fallo en la petición de red:", error);
    return { ok: false, status: 500, msg: "Error de conexión con el servidor." };
  }
}

// Atajo para invocar cualquier método de seguridad por el dispatcher /toProcess.
async function toProcess(objectName, methodName, params = []) {
  return await api('/toProcess', {
    method: 'POST',
    body: JSON.stringify({ subsystem: 'security', objectName, methodName, params })
  });
}

function showSwitchMsg(text, ok = true) {
  if (!switchMsg) return;
  switchMsg.textContent = text || '';
  switchMsg.className = 'msg ' + (ok ? 'ok' : 'error');
}

function showManageMsg(text, ok = true) {
  if (!manageMsg) return;
  manageMsg.textContent = text || '';
  manageMsg.className = 'msg ' + (ok ? 'ok' : 'error');
}

// Rellena un <select> con perfiles [{profile_id, profile_na}].
function fillProfileOptions(select, profiles) {
  if (!select) return;
  select.innerHTML = '';
  for (const p of profiles) {
    const opt = document.createElement('option');
    opt.value = p.profile_id;
    opt.textContent = p.profile_na;
    select.appendChild(opt);
  }
}

// Carga los datos del bloque de admin: lista de usuarios y catálogo de perfiles.
async function loadManageData() {
  if (!userSelect || !profileAssignSelect) return;
  const usersRes = await toProcess('User', 'listUsers', []);
  if (usersRes.ok && usersRes.data) {
    userSelect.innerHTML = '';
    for (const u of usersRes.data) {
      const opt = document.createElement('option');
      opt.value = u.user_id;
      opt.textContent = `#${u.user_id} · ${u.user_na}`;
      userSelect.appendChild(opt);
    }
  }
  const profRes = await toProcess('UserProfile', 'listProfiles', []);
  if (profRes.ok && profRes.data) fillProfileOptions(profileAssignSelect, profRes.data);
  await refreshUserProfiles();
}

// Muestra los perfiles que tiene asignados el usuario seleccionado.
async function refreshUserProfiles() {
  if (!userSelect || !userProfilesList) return;
  const user_id = Number(userSelect.value);
  userProfilesList.innerHTML = '';
  if (!user_id) return;
  const res = await toProcess('UserProfile', 'listUserProfiles', [user_id]);
  if (!res.ok || !res.data) return;
  for (const p of res.data) {
    const item = document.createElement('div');
    item.className = 'item';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `perfil #${p.profile_id}`;
    const profSpan = document.createElement('span');
    profSpan.className = 'tag';
    profSpan.textContent = p.profile_na;
    item.appendChild(nameSpan);
    item.appendChild(profSpan);
    userProfilesList.appendChild(item);
  }
}

// Habilita o bloquea los campos del formulario de "Crear cuenta".
function setRegisterEnabled(enabled) {
  if (!formRegister) return;
  for (const field of formRegister.elements) {
    field.disabled = !enabled;
  }
}

/* ==========================================================================
   Funciones de renderizado y sincronización
   ========================================================================== */

// Carga y renderiza de forma dinámica la lista de proyectos en tiempo real (Sol-Manager)
async function loadProjects() {
  if (!projectsList) return;
  projectsList.innerHTML = '';
  
  const res = await toProcess('Project', 'listProjects', []);
  if (res.ok && res.data) {
    for (const proj of res.data) {
      const tr = document.createElement('tr');
      
      const tdName = document.createElement('td');
      tdName.textContent = proj.project_na || 'Proyecto sin nombre';
      
      const tdLeader = document.createElement('td');
      tdLeader.textContent = proj.leader_name ? `#${proj.leader_id} · ${proj.leader_name}` : `ID de Líder: ${proj.leader_id}`;
      
      const tdActions = document.createElement('td');
      tdActions.className = 'text-right';
      tdActions.innerHTML = `<button class="btn-secondary" style="padding: 4px 8px; font-size:12px;">Ver detalles</button>`;
      
      tr.appendChild(tdName);
      tr.appendChild(tdLeader);
      tr.appendChild(tdActions);
      projectsList.appendChild(tr);
    }
  }
}

function renderSession(session) {
  if ($('#authContainer')) $('#authContainer').classList.add('hidden');
  if (panel) panel.classList.remove('hidden');
  if (whoami) whoami.textContent = `${session.user_na} (perfil ${session.profile_id})`;
  
  const canRegister = !!session.canRegister;
  if (registerBox) {
    registerBox.classList.remove('hidden');
    if (formRegister) {
      formRegister.reset();
      setRegisterEnabled(canRegister);
    }
    showRegisterMsg(canRegister ? '' : 'No tienes permiso para crear cuentas.', false);
  }
  
  if (resultMsg) showResultMsg('');
  if (resultList) resultList.innerHTML = '';

  if (profileSelect) {
    fillProfileOptions(profileSelect, session.profiles || []);
    profileSelect.value = session.profile_id;
  }
  showSwitchMsg('');

  if (session.canManageProfiles) {
    if (manageBox) {
      manageBox.classList.remove('hidden');
      loadManageData();
    }
  } else {
    if (manageBox) manageBox.classList.add('hidden');
  }

  // Sincroniza la vista de proyectos al cargar la sesión
  loadProjects();
}

function renderLoggedOut() {
  if (panel) panel.classList.add('hidden');
  if ($('#authContainer')) $('#authContainer').classList.remove('hidden');
  if (formLogin) {
    formLogin.classList.remove('hidden');
    formLogin.reset();
  }
  if (title) title.classList.remove('hidden');
  showMsg('');
}

/* ==========================================================================
   Manejadores de Eventos y Lógica de Envíos
   ========================================================================== */
if (formRegister) {
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(formRegister));
    
    // Validación estricta de proveedores institucionales y comerciales
    const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|outlook\.com|educa\.edu)$/;
    if (!emailRegex.test(body.user_na)) {
      showRegisterMsg('El usuario debe ser un correo válido de @gmail.com, @outlook.com o @educa.edu', false);
      return;
    }

    const res = await api('/register', { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      formRegister.reset();
      showRegisterMsg(res.msg, true);
    } else if (res.errors && res.errors.length) {
      showRegisterMsg('• ' + res.errors.join('\n• '), false);
    } else {
      showRegisterMsg(res.msg, false);
    }
  });
}

if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg('Autenticando...', true); 
    const body = Object.fromEntries(new FormData(formLogin));
    
    const res = await api('/login', { method: 'POST', body: JSON.stringify(body) });
    console.log("Respuesta del servidor /login:", res);

    if (res.ok) {
      if (res.objectSession) {
        formLogin.reset();
        renderSession(res.objectSession);
        showMsg(res.msg || 'Sesión iniciada correctamente', true);
      } else {
        showMsg('Error del servidor: No se recibió la estructura de sesión.', false);
      }
    } else {
      showMsg(res.msg || 'Usuario o contraseña incorrectos.', false);
    }
  });
}

if ($('#btnLogout')) {
  $('#btnLogout').addEventListener('click', async () => {
    const res = await api('/logout', { method: 'POST' });
    renderLoggedOut();
    showMsg(res.msg, res.ok);
  });
}

function renderUsers(rows) {
  if (!resultList) return;
  resultList.innerHTML = '';
  for (const u of rows) {
    const item = document.createElement('div');
    item.className = 'item';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `#${u.user_id} · ${u.user_na}`;
    const profSpan = document.createElement('span');
    profSpan.className = 'tag';
    profSpan.textContent = u.profile_na;
    item.appendChild(nameSpan);
    item.appendChild(profSpan);
    resultList.appendChild(item);
  }
}

if ($('#btnListUsers')) {
  $('#btnListUsers').addEventListener('click', async () => {
    const res = await toProcess('User', 'listUsers', []);
    if (res.ok && res.data) {
      renderUsers(res.data);
      showResultMsg(`Permitido: ${res.data.length} usuario(s).`, true);
    } else {
      if (resultList) resultList.innerHTML = '';
      showResultMsg(res.msg || 'Error.', false);
    }
  });
}

if ($('#btnSwitch')) {
  $('#btnSwitch').addEventListener('click', async () => {
    const profile_id = Number(profileSelect.value);
    const res = await api('/switchProfile', { method: 'POST', body: JSON.stringify({ profile_id }) });
    showSwitchMsg(res.msg, res.ok);
    if (res.ok) renderSession(res.objectSession);
  });
}

if (userSelect) {
  userSelect.addEventListener('change', refreshUserProfiles);
}

if ($('#btnAssign')) {
  $('#btnAssign').addEventListener('click', async () => {
    const params = [Number(userSelect.value), Number(profileAssignSelect.value)];
    const res = await toProcess('UserProfile', 'addUserProfile', params);
    showManageMsg(res.ok ? 'Perfil asignado.' : (res.msg || 'Error.'), res.ok);
    if (res.ok) refreshUserProfiles();
  });
}

if ($('#btnRemove')) {
  $('#btnRemove').addEventListener('click', async () => {
    const params = [Number(userSelect.value), Number(profileAssignSelect.value)];
    const res = await toProcess('UserProfile', 'removeUserProfile', params);
    showManageMsg(res.ok ? 'Perfil quitado.' : (res.msg || 'Error.'), res.ok);
    if (res.ok) refreshUserProfiles();
  });
}

// Al recargar la página, restaura la sesión si la cookie sigue viva.
(async () => {
  const res = await api('/me');
  if (res.ok && res.objectSession) {
    renderSession(res.objectSession);
  } else {
    renderLoggedOut();
  }
})();

/* ==========================================================================
   MÓDULO DE PROYECTOS (VERSIÓN DESACOPLADA MEDIANTE TEMPLATES)
   ========================================================================== */

// 1. Manejo de apertura y cierre seguro del Modal utilizando delegación de eventos
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'btnCreateProject') {
    const modal = document.querySelector('#projectModal');
    const container = document.querySelector('#membersContainer');
    const leaderField = document.querySelector('#projectLeader');

    if (modal) modal.classList.remove('hidden');
    if (container) container.innerHTML = ''; // Limpia filas viejas
    if (leaderField) leaderField.value = '';  // Inicializa vacío para ID numérico
  }

  if (e.target && e.target.id === 'btnCancelProject') {
    const modal = document.querySelector('#projectModal');
    const form = document.querySelector('#formProject');
    
    if (modal) modal.classList.add('hidden');
    if (form) form.reset();
  }
});

// 2. Agregar filas para añadir miembros clonando el molde del HTML (<template>)
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'btnAddMemberRow') {
    const container = document.querySelector('#membersContainer');
    const template = document.querySelector('#tmplMemberRow');
    
    if (!container || !template) return;

    // Clonamos la estructura interna del <template> de forma segura
    const clone = document.importNode(template.content, true);

    // Adjuntamos el comportamiento de eliminación al botón correspondiente del clon
    clone.querySelector('.btn-remove-row').addEventListener('click', (event) => {
      event.target.closest('.member-row').remove();
    });

    container.appendChild(clone);
  }
});

// 3. Procesar y guardar el formulario de creación de proyectos
document.addEventListener('submit', async (e) => {
  if (e.target && e.target.id === 'formProject') {
    e.preventDefault();
    
    const nameInput = document.querySelector('#projectName');
    const descInput = document.querySelector('#projectDescription');
    const leaderInput = document.querySelector('#projectLeader');

    const name = nameInput ? nameInput.value.trim() : '';
    const desc = descInput ? descInput.value.trim() : '';
    const leaderId = leaderInput ? Number(leaderInput.value) : null;

    if (!name || !leaderId) {
      alert('Por favor, ingresa el nombre del proyecto y un ID de líder válido.');
      return;
    }

    try {
      // 🔄 AJUSTE DE REORDENAMIENTO DEFINITIVO:
      // Modificamos el array a [leaderId, name, desc] para coincidir milimétricamente con los marcadores posicionales del SQL.
      const resProject = await toProcess('Project', 'insertProject', [leaderId, name, desc]);

      if (resProject.ok && resProject.data) {
        const rows = resProject.data;
        const newProjectId = rows[0] ? rows[0].project_id : null;

        if (newProjectId) {
          const memberIdInputs = document.querySelectorAll('input[name="member_user_id"]');
          const memberRoles = document.querySelectorAll('select[name="member_role"]');
          
          // Registrar uno a uno los integrantes mapeados en el DOM
          for (let i = 0; i < memberIdInputs.length; i++) {
            const mUserId = Number(memberIdInputs[i].value);
            const mRole = memberRoles[i].value;
            if (mUserId) {
              await toProcess('Project', 'insertProjectMember', [newProjectId, mUserId, mRole]);
            }
          }
        }

        const form = document.querySelector('#formProject');
        if (form) form.reset();
        
        const modal = document.querySelector('#projectModal');
        if (modal) modal.classList.add('hidden');
        
        alert('Proyecto creado y sincronizado exitosamente.');
        
        // Actualiza el dashboard visual automáticamente
        loadProjects();
      } else {
        alert('Error del sistema: ' + (resProject.msg || 'Asegúrate de que el ID del Líder exista en la base de datos.'));
      }
    } catch (err) {
      console.error('Error crítico durante el guardado:', err);
      alert('No se pudo conectar con el servidor para guardar el proyecto.');
    }
  }
});