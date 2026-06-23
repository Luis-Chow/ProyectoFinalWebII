const express = require('express');
const cors = require('cors');
const config = require('./config.json');
const DBComponent = require('./dbcomponent');
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

// Las cuentas creadas nacen como Cliente (perfil 2), nunca como Administrador.
const REGISTER_PROFILE_ID = 2;
const REGISTER_STATUS_ID = 1;

// El permiso para crear cuentas vive en la BD (permission_method), igual que cualquier otro metodo.
const REGISTER_J = { subsystem: 'security', objectName: 'User', methodName: 'insertUser' };
// Permiso para asignar/quitar perfiles a otros usuarios (tambien vive en la BD).
const MANAGE_PROFILES_J = { subsystem: 'security', objectName: 'UserProfile', methodName: 'addUserProfile' };

// Arma la respuesta de sesion: permisos (no se guardan en la cookie) + los perfiles que el usuario posee.
async function withPermissions(data) {
    const profiles = await global.dbc.exeQuery(
        global.dbc.getSentence('security', 'listUserProfiles'),
        [data.user_id]
    );
    return {
        ...data,
        profiles,
        canRegister: global.sec.getPermissionMethod(REGISTER_J, data.profile_id),
        canManageProfiles: global.sec.getPermissionMethod(MANAGE_PROFILES_J, data.profile_id)
    };
}

// Endpoint dinamico unico: intercepta la peticion, valida seguridad en cache y ejecuta la consulta SQL.
app.post('/toProcess', async (req, res) => {
    const s = new Session(req, global.dbc);
    if (!s.sessionExist()) {
        return res.status(401).json({ ok: false, data: { msg: 'No autorizado. Inicie sesión.' } });
    }

    const { subsystem, objectName, methodName, params } = req.body;
    if (!subsystem || !objectName || !methodName) {
        return res.status(400).json({ ok: false, data: { msg: 'Faltan campos obligatorios en el objeto j.' } });
    }

    const user = s.getDataSession();
    const hasPermission = global.sec.getPermissionMethod({ subsystem, objectName, methodName }, user.profile_id);

    if (!hasPermission) {
        return res.status(403).json({ ok: false, data: { msg: `Acceso denegado al método ${objectName}.${methodName}` } });
    }

    try {
        const rows = await global.sec.exeMethod({ subsystem, objectName, methodName, params });
        res.json({ ok: true, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, data: { msg: err.message } });
    }
});

// ✅ CONTROLADOR DE LOGIN UNIFICADO: Responde exactamente con 'objectSession' en la raíz del JSON
app.post('/login', async (req, res) => {
    try {
        const { user_na, user_pw } = req.body;
        const s = new Session(req, global.dbc);
        const result = await s.login(user_na, user_pw);

        if (result.ok && result.data) {
            const sessionCompleta = await withPermissions(result.data);
            return res.json({ 
                ok: true, 
                msg: 'Sesión iniciada correctamente', 
                objectSession: sessionCompleta 
            });
        } else {
            return res.status(401).json({ 
                ok: false, 
                msg: result.msg || 'Usuario o contraseña incorrectos.' 
            });
        }
    } catch (error) {
        console.error("Error en endpoint /login:", error);
        return res.status(500).json({ ok: false, msg: 'Error interno del servidor.' });
    }
});

app.post('/logout', async (req, res) => {
    const s = new Session(req, global.dbc);
    const result = await s.logout();
    res.json(result);
});

app.post('/switchProfile', async (req, res) => {
    const s = new Session(req, global.dbc);
    if (!s.sessionExist()) {
        return res.json({ ok: false, data: { msg: 'Sesión no válida.' } });
    }

    const { profile_id } = req.body;
    const user = s.getDataSession();

    const belongs = await global.dbc.exeQuery(
        'SELECT 1 FROM user_profile WHERE user_id = $1 AND profile_id = $2',
        [user.user_id, profile_id]
    );

    if (belongs.length === 0) {
        return res.json({ ok: false, data: { msg: 'No posees ese perfil.' } });
    }

    const updatedUser = s.setActiveProfile(profile_id);
    await global.dbc.exeQuery(global.dbc.getSentence('security', 'setUserActiveProfile'), [user.user_id, profile_id]);

    res.json({
        ok: true,
        data: { msg: 'Perfil cambiado exitosamente.' },
        objectSession: await withPermissions(updatedUser)
    });
});

// ✅ RESPUESTA EN BASE A LA COMPATIBILIDAD CON APP.JS (/session y alias /me)
const handleSessionGet = async (req, res) => {
    const s = new Session(req, global.dbc);
    if (s.sessionExist() && s.getDataSession()) {
        const sessionCompleta = await withPermissions(s.getDataSession());
        res.json({ ok: true, objectSession: sessionCompleta });
    } else {
        res.json({ ok: false, msg: "No hay sesión activa." });
    }
};

app.get('/session', handleSessionGet);
app.get('/me', handleSessionGet); // Mapeado para que el auto-login de app.js no falle si apunta a /me

// Inicializacion asincrona de tablas relacionales y sus semillas
(async () => {
    try {
        const ddl = [
            ['security', 'createUserTable'],
            ['model', 'createProfile'],
            ['model', 'createSubsystem'],
            ['model', 'createObject'],
            ['model', 'createMethod'],
            ['model', 'createOption'],
            ['model', 'createPermissionMethod'],
            ['model', 'createPermissionOption'],
            ['model', 'createUserProfile'],
            ['security', 'createProjectTable'],
            ['security', 'createProjectMembersTable']
        ];
        for (const [schema, id] of ddl) {
            await global.dbc.exeQuery(global.dbc.getSentence(schema, id));
        }

        const seeds = [
            ['model', 'seedProfileAdmin'],
            ['model', 'seedProfileCliente'],
            ['model', 'seedSubsystemSecurity'],
            ['model', 'seedObjectUser'],
            ['model', 'seedMethodListUsers'],
            ['model', 'seedMethodRegister'],
            ['model', 'seedPermAdminListUsers'],
            ['model', 'seedPermAdminRegister'],
            ['model', 'seedUserAdmin'],
            ['model', 'seedUserCliente'],
            ['model', 'seedUserProfile'],
            ['model', 'seedObjectUserProfile'],
            ['model', 'seedMethodListProfiles'],
            ['model', 'seedMethodListUserProfiles'],
            ['model', 'seedMethodAddUserProfile'],
            ['model', 'seedMethodRemoveUserProfile'],
            ['model', 'seedPermAdminListProfiles'],
            ['model', 'seedPermAdminListUserProfiles'],
            ['model', 'seedPermAdminAddUserProfile'],
            ['model', 'seedPermAdminRemoveUserProfile'],
            ['model', 'seedObjectProject'],
            ['model', 'seedMethodListProjects'],
            ['model', 'seedMethodListProjectMembers'],
            ['model', 'seedMethodInsertProject'],
            ['model', 'seedMethodInsertProjectMember'],
            ['model', 'seedPermAdminListProjects'],
            ['model', 'seedPermAdminListProjectMembers'],
            ['model', 'seedPermAdminInsertProject'],
            ['model', 'seedPermAdminInsertProjectMember']
        ];
        for (const [schema, id] of seeds) {
            await global.dbc.exeQuery(global.dbc.getSentence(schema, id));
        }
        console.log('Base de datos lista: modelo de seguridad, datos y proyectos.');

        global.sec = new Security();

        app.listen(config.server.port, () => {
            console.log(`Servidor escuchando en el puerto ${config.server.port}`);
        });
    } catch (err) {
        console.error('Fallo al inicializar la aplicación:', err.message);
        process.exit(1);
    }
})();
