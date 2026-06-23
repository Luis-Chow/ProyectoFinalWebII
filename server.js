const express = require('express');
const cors = require('cors');
const config = require('./config.json');
const DBComponent = require('./dbcomponent');
const { AppError } = require('./dbcomponent');
const Session = require('./session');
const Security = require('./security');
const path = require('path');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

global.dbc = new DBComponent();

Session.initMiddleware(app);

app.use(express.static(path.join(__dirname, 'public')));

// El permiso para crear cuentas vive en la BD (permission_method), igual que cualquier otro metodo.
// Se usa para decirle al cliente si debe habilitar el formulario de "Crear cuenta".
const REGISTER_J = { subsystem: 'security', objectName: 'User', methodName: 'insertUser' };
// Permiso para asignar/quitar perfiles a otros usuarios (tambien vive en la BD).
const MANAGE_PROFILES_J = { subsystem: 'security', objectName: 'UserProfile', methodName: 'addUserProfile' };
// Permiso para gestionar permisos de metodos por perfil (CU-04).
const MANAGE_PERMS_J = { subsystem: 'security', objectName: 'Permission', methodName: 'grantMethod' };
// Permiso para listar usuarios (decide si se muestra la pestaña "Listar usuarios").
const LIST_USERS_J = { subsystem: 'security', objectName: 'User', methodName: 'listUsers' };
// Permiso para el mantenimiento de perfiles (CRUD de profile).
const CRUD_PROFILES_J = { subsystem: 'security', objectName: 'Profile', methodName: 'insertProfile' };
// Permiso para activar/desactivar usuarios (decide si se muestran los toggles de estado).
const MANAGE_USERS_J = { subsystem: 'security', objectName: 'User', methodName: 'setUserStatus' };

// Subsistemas a los que el perfil activo tiene acceso (al menos un metodo permitido).
// Es la "subsystem list" que la pizarra entrega tras el login.
async function getSubsystems(profile_id) {
    return await global.dbc.exeQuery(global.dbc.getSentence('security', 'listAccessibleSubsystems'), [profile_id]);
}

// Auditoria centralizada de /toProcess: que metodo deja que accion en la tabla audit.
// (accion sigue el diseño de la pizarra 4: insert | delete | update.)
const AUDIT_ACTIONS = {
    insertUser: 'insert',
    addUserProfile: 'insert',
    removeUserProfile: 'delete',
    grantMethod: 'insert',
    revokeMethod: 'delete',
    insertProfile: 'insert',
    updateProfile: 'update',
    deleteProfile: 'delete',
    setUserStatus: 'update'
};

// Arma una descripcion legible de los params SIN exponer secretos (la contraseña nunca
// debe quedar en la auditoria, aunque hoy se guarde en claro en la tabla "user").
function describeParams(params) {
    if (params && !Array.isArray(params) && typeof params === 'object') {
        const safe = { ...params };
        if ('user_pw' in safe) safe.user_pw = '***';
        return JSON.stringify(safe);
    }
    return JSON.stringify(params);
}

// Inserta una fila de auditoria. Nunca rompe el flujo principal: si falla, solo avisa.
async function audit(ses, action, description) {
    try {
        const data = ses.getDataSession();
        if (!data || data.user_id == null) return;
        await global.dbc.exeQuery(global.dbc.getSentence('model', 'insertAudit'), [data.user_id, action, description]);
    } catch (err) {
        console.error('No se pudo registrar auditoría:', err.message);
    }
}

// Arma la respuesta de sesion: agrega los permisos (no se guardan en la cookie).
async function withPermissions(data) {
    return {
        ...data,
        canRegister: global.sec.getPermissionMethod(REGISTER_J, data.profile_id),
        canManageProfiles: global.sec.getPermissionMethod(MANAGE_PROFILES_J, data.profile_id),
        canManagePermissions: global.sec.getPermissionMethod(MANAGE_PERMS_J, data.profile_id),
        canListUsers: global.sec.getPermissionMethod(LIST_USERS_J, data.profile_id),
        canCrudProfiles: global.sec.getPermissionMethod(CRUD_PROFILES_J, data.profile_id),
        canManageUsers: global.sec.getPermissionMethod(MANAGE_USERS_J, data.profile_id)
    };
}

app.post('/login', async (req, res) => {
    const { user_na, user_pw } = req.body;
    if (!user_na || !user_pw) {
        return res.status(400).json({ msg: 'Falta usuario o contraseña.' });
    }
    try {
        const ses = new Session(req, global.dbc);
        const result = await ses.login(user_na, user_pw);
        if (!result.ok) {
            return res.status(401).json({ msg: result.msg });
        }

        const profiles = result.profiles;

        // Sin perfiles asignados el usuario no puede operar -> se cancela la sesion.
        if (profiles.length === 0) {
            await ses.logout();
            return res.status(403).json({ msg: 'El usuario no tiene perfiles asignados. Contacte al administrador.' });
        }

        // Perfil activo por defecto = el primero. El usuario puede cambiarlo luego con el
        // selector de perfil (abajo en la ventana). Tras el login se elige el SUBSISTEMA.
        ses.setActiveProfile(profiles[0]);
        await audit(ses, 'login', `Inició sesión como ${profiles[0].profile_de}`);
        const subsystems = await getSubsystems(profiles[0].profile_id);
        return res.json({
            msg: 'Login OK.',
            objectSession: await withPermissions(ses.getDataSession()),
            profiles,
            subsystems
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error al iniciar sesión.' });
    }
});

// Cambiar de perfil activo (selector de perfil en la ventana). Recalcula permisos y
// subsistemas accesibles para el nuevo perfil.
app.post('/selectProfile', async (req, res) => {
    try {
        const ses = new Session(req, global.dbc);
        if (!ses.sessionExist()) {
            return res.status(401).json({ msg: 'Debe iniciar sesión.' });
        }
        const data = ses.getDataSession();
        const profile_id = Number(req.body.profile_id);

        // Nunca confiar en el cliente: el perfil elegido debe pertenecer a este usuario.
        const profiles = await ses.getProfiles(data.user_id);
        const chosen = profiles.find((p) => p.profile_id === profile_id);
        if (!chosen) {
            return res.status(403).json({ msg: 'Perfil no válido para este usuario.' });
        }

        ses.setActiveProfile(chosen);
        await audit(ses, 'login', `Cambió al perfil ${chosen.profile_de}`);
        const subsystems = await getSubsystems(chosen.profile_id);
        return res.json({
            msg: 'Perfil activo.',
            objectSession: await withPermissions(ses.getDataSession()),
            subsystems
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error al seleccionar el perfil.' });
    }
});

app.post('/logout', async (req, res) => {
    try {
        const ses = new Session(req, global.dbc);
        if (ses.hasActiveProfile()) {
            await audit(ses, 'logout', 'Cerró sesión');
        }
        await ses.logout();
        res.clearCookie(config.session.name);
        res.json({ msg: 'Sesión cerrada.' });
    } catch (err) {
        res.status(500).json({ msg: 'Error al cerrar sesión.' });
    }
});

app.get('/me', async (req, res) => {
    const ses = new Session(req, global.dbc);
    if (!ses.sessionExist()) {
        return res.status(401).json({ msg: 'No hay sesión activa.' });
    }
    let data = ses.getDataSession();
    // Por si la sesion quedo sin perfil activo (caso raro): activar el primero.
    if (data.profile_id == null) {
        const profiles = await ses.getProfiles(data.user_id);
        if (profiles.length) ses.setActiveProfile(profiles[0]);
        data = ses.getDataSession();
    }
    const profiles = await ses.getProfiles(data.user_id);
    const subsystems = await getSubsystems(data.profile_id);
    res.json({ objectSession: await withPermissions(data), profiles, subsystems });
});

// Dispatcher: toda solicitud de ejecucion de metodos entra por aqui.
app.post('/toProcess', async (req, res) => {
    try {
        // 1) ¿tiene sesion?
        const ses = new Session(req, global.dbc);
        if (!ses.sessionExist()) {
            return res.status(401).json({ msg: 'Debe iniciar sesión.' });
        }
        // 2) ¿ya eligio perfil activo? Sin perfil no se pueden resolver permisos.
        if (!ses.hasActiveProfile()) {
            return res.status(403).json({ msg: 'Debe seleccionar un perfil.' });
        }

        // 3) datos de la transaccion (j) y de la sesion
        const data = ses.getDataSession();
        const j = {
            subsystem: req.body.subsystem,
            objectName: req.body.objectName,
            methodName: req.body.methodName,
            params: req.body.params || []
        };

        // 4) ¿tiene permiso de ejecutar el metodo?
        if (!global.sec.getPermissionMethod(j, data.profile_id)) {
            return res.status(403).json({ msg: 'Acceso denegado.' });
        }

        // 5) ejecuta el metodo (pasando la sesion)
        const rows = await global.sec.exeMethod(j, data);

        // 6) auditoria de los metodos que modifican datos
        if (AUDIT_ACTIONS[j.methodName]) {
            await audit(ses, AUDIT_ACTIONS[j.methodName], `${j.objectName}.${j.methodName} ${describeParams(j.params)}`);
        }

        return res.json({ data: rows });
    } catch (err) {
        // Un metodo rico puede lanzar AppError con su propio status (400 validacion, 409 duplicado...).
        if (err instanceof AppError) {
            return res.status(err.status).json({ msg: err.message, errors: err.errors });
        }
        console.error('Error en /toProcess:', err);
        return res.status(500).json({ msg: 'Error al procesar la solicitud.' });
    }
});

(async () => {
    try {
        // DDL: se reconstruye el esquema de seguridad para que coincida EXACTO con el modelo.
        // dropAll va primero porque las tablas viejas (users, subsystem, profile_na...) tienen
        // otras columnas; con CREATE IF NOT EXISTS no se actualizarian. Los datos son semilla.
        const ddl = [
            ['model', 'dropAll'],
            ['model', 'createStatus'],
            ['model', 'createProfile'],
            ['model', 'createSubSystem'],
            ['model', 'createObject'],
            ['model', 'createMethod'],
            ['model', 'createOption'],
            ['model', 'createUser'],
            ['model', 'createUserProfile'],
            ['model', 'createPermissionMethod'],
            ['model', 'createPermissionOption'],
            ['model', 'createAudit']
        ];
        for (const [schema, id] of ddl) {
            await global.dbc.exeQuery(global.dbc.getSentence(schema, id));
        }

        // Seeds: en orden de dependencias (catalogos -> usuarios -> perfiles de usuario).
        const seeds = [
            ['model', 'seedStatusActivo'],
            ['model', 'seedStatusInactivo'],
            ['model', 'seedProfileAdmin'],
            ['model', 'seedProfileEmpleado'],
            ['model', 'seedProfileLider'],
            ['model', 'syncProfileSeq'],
            ['model', 'seedSubSystemSecurity'],
            ['model', 'seedObjectUser'],
            ['model', 'seedObjectUserProfile'],
            ['model', 'seedObjectPermission'],
            ['model', 'seedObjectProfile'],
            ['model', 'seedMethodListUsers'],
            ['model', 'seedMethodInsertUser'],
            ['model', 'seedMethodSetUserStatus'],
            ['model', 'seedMethodListProfiles'],
            ['model', 'seedMethodListUserProfiles'],
            ['model', 'seedMethodAddUserProfile'],
            ['model', 'seedMethodRemoveUserProfile'],
            ['model', 'seedMethodListPermissionMethods'],
            ['model', 'seedMethodGrantMethod'],
            ['model', 'seedMethodRevokeMethod'],
            ['model', 'seedMethodInsertProfile'],
            ['model', 'seedMethodUpdateProfile'],
            ['model', 'seedMethodDeleteProfile'],
            ['model', 'seedPermAdminListUsers'],
            ['model', 'seedPermAdminInsertUser'],
            ['model', 'seedPermAdminSetUserStatus'],
            ['model', 'seedPermAdminListProfiles'],
            ['model', 'seedPermAdminListUserProfiles'],
            ['model', 'seedPermAdminAddUserProfile'],
            ['model', 'seedPermAdminRemoveUserProfile'],
            ['model', 'seedPermAdminListPermissionMethods'],
            ['model', 'seedPermAdminGrantMethod'],
            ['model', 'seedPermAdminRevokeMethod'],
            ['model', 'seedPermAdminInsertProfile'],
            ['model', 'seedPermAdminUpdateProfile'],
            ['model', 'seedPermAdminDeleteProfile'],
            ['model', 'seedUserAdmin'],
            ['model', 'seedUserEmpleado'],
            ['model', 'seedUserProfileAdmin'],
            ['model', 'seedUserProfileAdminLider'],
            ['model', 'seedUserProfileEmpleado']
        ];
        for (const [schema, id] of seeds) {
            await global.dbc.exeQuery(global.dbc.getSentence(schema, id));
        }
        console.log('Base de datos lista: modelo de seguridad y datos.');

        global.sec = new Security();

        app.listen(config.server.port, () => {
            console.log(`Servidor escuchando en el puerto ${config.server.port}`);
        });
    } catch (err) {
        console.error('Fallo al inicializar la aplicación:', err.message);
        process.exit(1);
    }
})();
