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

// Auditoria centralizada de /toProcess: que metodo deja que accion en la tabla audit.
// (accion sigue el diseño de la pizarra 4: insert | delete | update.)
const AUDIT_ACTIONS = {
    insertUser: 'insert',
    addUserProfile: 'insert',
    removeUserProfile: 'delete'
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
        canManageProfiles: global.sec.getPermissionMethod(MANAGE_PROFILES_J, data.profile_id)
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

        // Un solo perfil -> se activa solo y entra directo (no tiene sentido elegir).
        if (profiles.length === 1) {
            ses.setActiveProfile(profiles[0]);
            await audit(ses, 'login', `Inició sesión como ${profiles[0].profile_de}`);
            return res.json({ msg: 'Login OK.', ready: true, objectSession: await withPermissions(ses.getDataSession()) });
        }

        // Varios perfiles -> el cliente muestra la pantalla "Perfiles" para elegir el activo.
        return res.json({ msg: 'Selecciona con qué perfil deseas trabajar.', ready: false, profiles });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error al iniciar sesión.' });
    }
});

// Segundo paso del login: el usuario eligio un perfil en la pantalla "Perfiles".
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
        await audit(ses, 'login', `Inició sesión como ${chosen.profile_de}`);
        return res.json({ msg: 'Perfil activo.', objectSession: await withPermissions(ses.getDataSession()) });
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
    const data = ses.getDataSession();
    // Sesion iniciada pero sin perfil elegido: reanudar en la pantalla "Perfiles".
    if (data.profile_id == null) {
        const profiles = await ses.getProfiles(data.user_id);
        return res.json({ ready: false, profiles });
    }
    res.json({ ready: true, objectSession: await withPermissions(data) });
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
            ['model', 'seedSubSystemSecurity'],
            ['model', 'seedObjectUser'],
            ['model', 'seedObjectUserProfile'],
            ['model', 'seedMethodListUsers'],
            ['model', 'seedMethodInsertUser'],
            ['model', 'seedMethodListProfiles'],
            ['model', 'seedMethodListUserProfiles'],
            ['model', 'seedMethodAddUserProfile'],
            ['model', 'seedMethodRemoveUserProfile'],
            ['model', 'seedPermAdminListUsers'],
            ['model', 'seedPermAdminInsertUser'],
            ['model', 'seedPermAdminListProfiles'],
            ['model', 'seedPermAdminListUserProfiles'],
            ['model', 'seedPermAdminAddUserProfile'],
            ['model', 'seedPermAdminRemoveUserProfile'],
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
