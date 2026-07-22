const { AppError } = require('./dbcomponent');

const SEP = '-';
const buildKey = (...parts) => parts.join(SEP);

// Validacion compartida por insertPerson/updatePerson. Devuelve los campos ya limpios
// (trim + null si van vacios) o lanza AppError(400) con la lista de errores.
function validatePerson(params) {
    const person_ci = (params.person_ci || '').trim();
    const person_na = (params.person_na || '').trim();
    const person_ln = (params.person_ln || '').trim();
    const person_mail = (params.person_mail || '').trim();
    const person_phone = (params.person_phone || '').trim();
    const charge_id = params.charge_id ? Number(params.charge_id) : null;

    const errors = [];
    if (person_ci.length < 4) errors.push('La cédula debe tener al menos 4 caracteres.');
    if (!/^[0-9A-Za-z-]+$/.test(person_ci || '-')) errors.push('La cédula solo admite números, letras y guiones.');
    if (person_na.length < 2) errors.push('El nombre debe tener al menos 2 caracteres.');
    if (person_ln.length < 2) errors.push('El apellido debe tener al menos 2 caracteres.');
    if (person_mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person_mail)) errors.push('El correo no tiene un formato válido.');
    if (errors.length) throw new AppError(400, 'No se pudo guardar la persona: revisa los requisitos.', errors);

    return { person_ci, person_na, person_ln, person_mail: person_mail || null, person_phone: person_phone || null, charge_id };
}

// Metodos "ricos": funciones de servidor con validacion, valores forzados y transaccion.
// Clave: subsystem.objectName.methodName. Si un metodo NO esta aqui, exeMethod cae al
// comportamiento simple (ejecutar 1 sentencia SQL con los params del cliente).
const businessMethods = {
    'security.User.insertUser': async (ctx) => {
        const { user_na, user_pw } = ctx.params || {};

        // 1) Validacion.
        const errors = [];
        if (!user_na || user_na.length < 3) errors.push('El usuario debe tener al menos 3 caracteres.');
        if (/\s/.test(user_na || '')) errors.push('El usuario no debe contener espacios.');
        if (!user_pw || user_pw.length < 8) errors.push('La contraseña debe tener al menos 8 caracteres.');
        if ((user_pw || '').length > 64) errors.push('La contraseña no debe superar los 64 caracteres.');
        if (/\s/.test(user_pw || '')) errors.push('La contraseña no debe contener espacios.');
        if (!/[a-z]/.test(user_pw || '')) errors.push('La contraseña debe incluir al menos una letra minúscula.');
        if (!/[A-Z]/.test(user_pw || '')) errors.push('La contraseña debe incluir al menos una letra mayúscula.');
        if (!/[0-9]/.test(user_pw || '')) errors.push('La contraseña debe incluir al menos un número.');
        if (errors.length) throw new AppError(400, 'No se pudo registrar: revisa los requisitos.', errors);

        // 2) Valores forzados por el servidor: toda cuenta nace como Empleado activo.
        //    El cliente NO elige el perfil (evita escalada a Administrador).
        const PROFILE_EMPLEADO = 2;
        const STATUS_ACTIVO = 1;

        // 2b) Persona a vincular (opcional): una cuenta puede crearse ya asociada a una
        //     persona de la nomina, o quedar sin persona y vincularla despues.
        const { person_id } = ctx.params || {};

        // 3) Transaccion: el usuario, su user_profile y el vinculo con la persona (si se
        //    eligio) se crean juntos, o no se crea nada. "user" no tiene profile_id: el
        //    perfil vive en user_profile.
        try {
            return await ctx.tx(async (q) => {
                const rows = await q(global.dbc.getSentence('security', 'insertUser'),
                    [user_na, user_pw, STATUS_ACTIVO]);
                const newUserId = rows[0].user_id;
                await q(global.dbc.getSentence('model', 'insertUserProfile'), [newUserId, PROFILE_EMPLEADO]);
                if (person_id) {
                    await q(global.dbc.getSentence('security', 'linkPersonUser'), [person_id, newUserId]);
                }
                return { user_id: newUserId };
            });
        } catch (err) {
            if (err.code === '23505') {
                // Puede chocar el user_na o el vinculo (persona/usuario ya asociados).
                if (String(err.constraint || '').includes('person_user')) {
                    throw new AppError(409, 'Esa persona ya tiene una cuenta asociada.');
                }
                throw new AppError(409, 'El usuario ya existe.');
            }
            throw err;
        }
    },

    // ---- Mantenimiento de personas (nomina): CRUD + vinculo con cuentas ----

    'security.Person.insertPerson': async (ctx) => {
        const p = validatePerson(ctx.params || {});
        try {
            const rows = await global.dbc.exeQuery(global.dbc.getSentence('security', 'insertPerson'),
                [p.person_ci, p.person_na, p.person_ln, p.person_mail, p.person_phone, p.charge_id]);
            return { person_id: rows[0].person_id };
        } catch (err) {
            if (err.code === '23505') throw new AppError(409, 'Ya existe una persona con esa cédula.');
            throw err;
        }
    },

    'security.Person.updatePerson': async (ctx) => {
        const { person_id } = ctx.params || {};
        if (!person_id) throw new AppError(400, 'Falta la persona a editar.');
        const p = validatePerson(ctx.params || {});
        try {
            await global.dbc.exeQuery(global.dbc.getSentence('security', 'updatePerson'),
                [person_id, p.person_ci, p.person_na, p.person_ln, p.person_mail, p.person_phone, p.charge_id]);
            return { updated: true };
        } catch (err) {
            if (err.code === '23505') throw new AppError(409, 'Ya existe una persona con esa cédula.');
            throw err;
        }
    },

    // Vincula una persona existente con una cuenta existente (1:1). Los UNIQUE de
    // person_user impiden que una persona o una cuenta tengan mas de un vinculo.
    'security.Person.linkPersonUser': async (ctx) => {
        const [person_id, user_id] = ctx.params || [];
        if (!person_id || !user_id) throw new AppError(400, 'Faltan la persona o la cuenta.');
        try {
            await global.dbc.exeQuery(global.dbc.getSentence('security', 'linkPersonUser'), [person_id, user_id]);
            return { linked: true };
        } catch (err) {
            if (err.code === '23505') throw new AppError(409, 'Esa persona o esa cuenta ya tienen un vínculo.');
            throw err;
        }
    },

    // ---- Auditoria (CU-05) ----
    // Por defecto los ultimos 500 movimientos; opcionalmente acotado por rango de fechas.
    'security.Audit.listAudit': async (ctx) => {
        const { dateFrom = null, dateTo = null, limit = 500 } = ctx.params || {};
        const rows = await global.dbc.exeQuery(global.dbc.getSentence('security', 'listAudit'),
            [dateFrom || null, dateTo || null, Number(limit) || 500]);
        return rows;
    },

    // CU-02 Mantenimiento de usuarios: activar/desactivar una cuenta (status_id).
    // Candado: no puedes desactivar tu propia cuenta (te bloquearias al volver a entrar).
    'security.User.setUserStatus': async (ctx) => {
        const [user_id, status_id] = ctx.params || [];
        if (!user_id || !status_id) throw new AppError(400, 'Faltan user_id o status_id.');
        const STATUS_INACTIVO = 2;
        if (Number(user_id) === Number(ctx.session.user_id) && Number(status_id) === STATUS_INACTIVO) {
            throw new AppError(409, 'No puedes desactivar tu propia cuenta.');
        }
        await global.dbc.exeQuery(global.dbc.getSentence('security', 'setUserStatus'), [user_id, status_id]);
        return { ok: true };
    },

    // CU-04 Gestionar permisos: conceder un metodo a un perfil. Tras escribir en la BD
    // hay que RECARGAR la cache en memoria para que el permiso aplique de inmediato.
    'security.Permission.grantMethod': async (ctx) => {
        const [profile_id, method_id] = ctx.params || [];
        if (!profile_id || !method_id) throw new AppError(400, 'Faltan profile_id o method_id.');
        await global.dbc.exeQuery(global.dbc.getSentence('security', 'grantMethod'), [profile_id, method_id]);
        await global.sec.loadPermissionMethod();   // refresca el Map de permisos
        return { granted: true };
    },

    // CU-04: quitar un metodo a un perfil (+ recarga de cache).
    'security.Permission.revokeMethod': async (ctx) => {
        const [profile_id, method_id] = ctx.params || [];
        if (!profile_id || !method_id) throw new AppError(400, 'Faltan profile_id o method_id.');

        // Candado anti-bloqueo: NO puedes quitarte a TI MISMO (perfil activo) un metodo del
        // objeto Permission (listMethods/grantMethod/revokeMethod...). Si lo hicieras te
        // quedarias sin poder gestionar permisos y sin forma de revertirlo desde la app.
        const activeProfile = ctx.session && ctx.session.profile_id;
        if (Number(profile_id) === Number(activeProfile)) {
            const r = await global.dbc.exeQuery(global.dbc.getSentence('security', 'isPermissionMethod'), [method_id]);
            if (r[0] && r[0].is_perm) {
                throw new AppError(409, 'No puedes quitarte a ti mismo los permisos de gestión de permisos.');
            }
        }

        await global.dbc.exeQuery(global.dbc.getSentence('security', 'revokeMethod'), [profile_id, method_id]);
        await global.sec.loadPermissionMethod();   // refresca el Map de permisos
        return { revoked: true };
    },

    // CU-04 (opciones): conceder una opcion de menu a un perfil. Recarga la cache de opciones.
    'security.Permission.grantOption': async (ctx) => {
        const [profile_id, option_id] = ctx.params || [];
        if (!profile_id || !option_id) throw new AppError(400, 'Faltan profile_id o option_id.');
        await global.dbc.exeQuery(global.dbc.getSentence('security', 'grantOption'), [profile_id, option_id]);
        await global.sec.loadPermissionOption();
        return { granted: true };
    },

    // CU-04 (opciones): quitar una opcion de menu a un perfil. Candado: no puedes ocultarte
    // a ti mismo (perfil activo) el menu de "Asignar permisos" (option_de = permBox).
    'security.Permission.revokeOption': async (ctx) => {
        const [profile_id, option_id] = ctx.params || [];
        if (!profile_id || !option_id) throw new AppError(400, 'Faltan profile_id o option_id.');
        const activeProfile = ctx.session && ctx.session.profile_id;
        if (Number(profile_id) === Number(activeProfile)) {
            const r = await global.dbc.exeQuery(global.dbc.getSentence('security', 'getOptionDe'), [option_id]);
            if (r[0] && r[0].option_de === 'permBox') {
                throw new AppError(409, 'No puedes ocultarte a ti mismo el menú de Asignar permisos.');
            }
        }
        await global.dbc.exeQuery(global.dbc.getSentence('security', 'revokeOption'), [profile_id, option_id]);
        await global.sec.loadPermissionOption();
        return { revoked: true };
    },

    // Mantenimiento de perfiles: eliminar un perfil. Candado: no se puede borrar un perfil
    // que aun tiene usuarios asignados (quedarian sin rol y sin poder iniciar sesion).
    // Al borrarlo, sus filas en permission_method/permission_option caen por CASCADE -> recargar.
    'security.Profile.deleteProfile': async (ctx) => {
        const [profile_id] = ctx.params || [];
        if (!profile_id) throw new AppError(400, 'Falta profile_id.');
        const used = await global.dbc.exeQuery(global.dbc.getSentence('security', 'countProfileUsers'), [profile_id]);
        if (used[0] && Number(used[0].n) > 0) {
            throw new AppError(409, 'No puedes eliminar un perfil con usuarios asignados. Quítalo de los usuarios primero.');
        }
        await global.dbc.exeQuery(global.dbc.getSentence('security', 'deleteProfile'), [profile_id]);
        await global.sec.loadPermissionMethod();
        await global.sec.loadPermissionOption();
        return { deleted: true };
    },

    // ---- Subsistema de proyectos (CU-06 / CU-07) ----

    // CU-06: crear un proyecto. El cliente manda {name, leader_person_id}; el estado lo
    // fuerza el servidor (todo proyecto nace Activo). El lider NO es una columna de proyect:
    // en el modelo canonico es un proyect_role 'Líder' con la persona enlazada.
    'proyectos.Proyect.insertProyect': async (ctx) => {
        const { name, leader_person_id } = ctx.params || {};
        const errors = [];
        const cleanName = (name || '').trim();
        if (cleanName.length < 3) errors.push('El nombre del proyecto debe tener al menos 3 caracteres.');
        if (!leader_person_id) errors.push('Debes elegir el líder del proyecto.');
        if (errors.length) throw new AppError(400, 'No se pudo crear el proyecto: revisa los requisitos.', errors);

        const person = await global.dbc.exeQuery(global.dbc.getSentence('proyectos', 'personExists'), [leader_person_id]);
        if (!person.length) throw new AppError(404, 'La persona elegida como líder no existe.');

        const STATUS_ACTIVO = 1;
        // Transaccion: proyecto + rol 'Líder' + persona enlazada se crean juntos, o nada.
        return await ctx.tx(async (q) => {
            const rows = await q(global.dbc.getSentence('proyectos', 'insertProyect'), [STATUS_ACTIVO, cleanName]);
            const proyectId = rows[0].id;
            const role = await q(global.dbc.getSentence('proyectos', 'insertProyectRole'), [proyectId, 'Líder']);
            await q(global.dbc.getSentence('proyectos', 'insertProyectRolePerson'), [role[0].id, leader_person_id]);
            return { id: proyectId, name: cleanName };
        });
    },

    // CU-07: asignar una persona a un proyecto con un rol (cargo dentro del proyecto).
    // El rol se busca o se crea en proyect_role; la persona se enlaza via proyect_role_person.
    'proyectos.Proyect.assignMember': async (ctx) => {
        const [proyect_id, person_id, role_name] = ctx.params || [];
        const cleanRole = (role_name || '').trim();
        if (!proyect_id || !person_id || !cleanRole) {
            throw new AppError(400, 'Faltan proyecto, persona o rol.');
        }

        const proyect = await global.dbc.exeQuery(global.dbc.getSentence('proyectos', 'getProyect'), [proyect_id]);
        if (!proyect.length) throw new AppError(404, 'El proyecto no existe.');
        const STATUS_CULMINADO = 3;
        if (proyect[0].status_id === STATUS_CULMINADO) {
            throw new AppError(409, 'No puedes asignar miembros a un proyecto culminado.');
        }

        const person = await global.dbc.exeQuery(global.dbc.getSentence('proyectos', 'personExists'), [person_id]);
        if (!person.length) throw new AppError(404, 'La persona no existe.');

        const dup = await global.dbc.exeQuery(global.dbc.getSentence('proyectos', 'memberExists'), [proyect_id, person_id]);
        if (dup[0] && dup[0].dup) throw new AppError(409, 'Esa persona ya es miembro del proyecto.');

        return await ctx.tx(async (q) => {
            let role = await q(global.dbc.getSentence('proyectos', 'findProyectRole'), [proyect_id, cleanRole]);
            if (!role.length) {
                role = await q(global.dbc.getSentence('proyectos', 'insertProyectRole'), [proyect_id, cleanRole]);
            }
            await q(global.dbc.getSentence('proyectos', 'insertProyectRolePerson'), [role[0].id, person_id]);
            return { assigned: true };
        });
    },

    // CU-15 (base): marcar un proyecto Activo o Culminado. El servidor solo acepta esos
    // dos estados (Inactivo es de usuarios, no de proyectos).
    'proyectos.Proyect.setProyectStatus': async (ctx) => {
        const [proyect_id, status_id] = ctx.params || [];
        const STATUS_ACTIVO = 1;
        const STATUS_CULMINADO = 3;
        if (!proyect_id || ![STATUS_ACTIVO, STATUS_CULMINADO].includes(Number(status_id))) {
            throw new AppError(400, 'Estado de proyecto no válido (Activo o Culminado).');
        }
        const proyect = await global.dbc.exeQuery(global.dbc.getSentence('proyectos', 'getProyect'), [proyect_id]);
        if (!proyect.length) throw new AppError(404, 'El proyecto no existe.');
        await global.dbc.exeQuery(global.dbc.getSentence('proyectos', 'setProyectStatus'), [proyect_id, status_id]);
        return { updated: true };
    },

    // ============ ACTIVITIES ============

    // CU-08: crear una actividad dentro de un proyecto activo.
    'proyectos.Activity.insertActivity': async (ctx) => {
        const { proyect_id, name, description, hours } = ctx.params || {};
        const errors = [];
        const cleanName = (name || '').trim();
        const cleanDescription = (description || '').trim();
        const numHours = parseInt(hours) || 0;

        if (!proyect_id) errors.push('El proyecto es obligatorio.');
        if (cleanName.length < 3) errors.push('El nombre de la actividad debe tener al menos 3 caracteres.');
        if (numHours <= 0) errors.push('Las horas estimadas deben ser mayores a 0.');

        if (errors.length) throw new AppError(400, 'No se pudo crear la actividad.', errors);

        // Verificar que el proyecto existe y está activo
        const proyect = await global.dbc.exeQuery(global.dbc.getSentence('proyectos', 'getProyect'), [proyect_id]);
        if (!proyect.length) throw new AppError(404, 'El proyecto no existe.');

        const rows = await global.dbc.exeQuery(
            global.dbc.getSentence('proyectos', 'insertActivity'),
            [proyect_id, cleanName, cleanDescription, numHours]
        );
        return { id: rows[0].id, name: cleanName };
    },

    // CU-08: editar una actividad (nombre, descripción, horas). Misma validación que al crear.
    'proyectos.Activity.updateActivity': async (ctx) => {
        const { activity_id, name, description, hours } = ctx.params || {};
        if (!activity_id) throw new AppError(400, 'Falta la actividad a editar.');
        const errors = [];
        const cleanName = (name || '').trim();
        const cleanDescription = (description || '').trim();
        const numHours = parseInt(hours) || 0;
        if (cleanName.length < 3) errors.push('El nombre de la actividad debe tener al menos 3 caracteres.');
        if (numHours <= 0) errors.push('Las horas estimadas deben ser mayores a 0.');
        if (errors.length) throw new AppError(400, 'No se pudo actualizar la actividad.', errors);

        const activity = await global.dbc.exeQuery(global.dbc.getSentence('proyectos', 'getActivity'), [activity_id]);
        if (!activity.length) throw new AppError(404, 'La actividad no existe.');

        await global.dbc.exeQuery(global.dbc.getSentence('proyectos', 'updateActivity'),
            [activity_id, cleanName, cleanDescription, numHours]);
        return { updated: true };
    },

    // CU-09: asignar persona a actividad
    'proyectos.Activity.assignActivity': async (ctx) => {
        const [activity_id, person_id] = ctx.params || [];
        if (!activity_id || !person_id) {
            throw new AppError(400, 'Faltan la actividad o la persona.');
        }

        // Verificar que la actividad existe
        const activity = await global.dbc.exeQuery(
            global.dbc.getSentence('proyectos', 'getActivity'),
            [activity_id]
        );
        if (!activity.length) throw new AppError(404, 'La actividad no existe.');

        // Solo se pueden asignar actividades a MIEMBROS del proyecto (proyect_role_person).
        // Para incorporar a alguien primero hay que agregarlo como miembro (CU-07).
        const member = await global.dbc.exeQuery(
            global.dbc.getSentence('proyectos', 'memberExists'),
            [activity[0].proyect_id, person_id]
        );
        if (!(member[0] && member[0].dup)) {
            throw new AppError(409, 'Esa persona no es miembro del proyecto. Agrégala primero como miembro del proyecto.');
        }

        // ON CONFLICT DO NOTHING RETURNING: si la persona ya estaba asignada no devuelve
        // fila -> avisamos con 409 en vez de simular un alta que no ocurrió.
        const inserted = await global.dbc.exeQuery(
            global.dbc.getSentence('proyectos', 'assignActivity'),
            [activity_id, person_id]
        );
        if (!inserted.length) throw new AppError(409, 'Esta persona ya está asignada a la actividad.');
        return { assigned: true };
    },

    // CU-11: insertar reporte de avance (50-100%)
    'proyectos.Activity.insertReport': async (ctx) => {
        const { activity_id, person_id, percentage, description } = ctx.params || {};
        const errors = [];
        const cleanDescription = (description || '').trim();
        const numPercentage = parseInt(percentage) || 0;

        if (!activity_id) errors.push('La actividad es obligatoria.');
        if (!person_id) errors.push('La persona es obligatoria.');
        if (numPercentage < 50 || numPercentage > 100) {
            errors.push('El porcentaje debe estar entre 50% y 100%.');
        }
        if (!cleanDescription || cleanDescription.length < 10) {
            errors.push('La descripción debe tener al menos 10 caracteres.');
        }

        if (errors.length) throw new AppError(400, 'No se pudo registrar el reporte.', errors);

        // Verificar que la actividad existe
        const activity = await global.dbc.exeQuery(
            global.dbc.getSentence('proyectos', 'getActivity'),
            [activity_id]
        );
        if (!activity.length) throw new AppError(404, 'La actividad no existe.');

        const STATUS_CULMINADO = 3;
        const completed = numPercentage >= 100;

        return await ctx.tx(async (q) => {
            const rows = await q(
                global.dbc.getSentence('proyectos', 'insertReport'),
                [activity_id, person_id, numPercentage, cleanDescription, completed]
            );

            if (completed) {
                await q(
                    global.dbc.getSentence('proyectos', 'updateActivityStatus'),
                    [activity_id, STATUS_CULMINADO]
                );
            }

            return { id: rows[0].id, percentage: numPercentage, completed };
        });
    },

    // CU-09: el líder notifica a su equipo (los miembros del proyecto). El emisor NO viene
    // del cliente: se toma de la sesión (evita suplantar a otro). Valida el mensaje y que
    // el proyecto exista.
    'proyectos.Notification.sendNotification': async (ctx) => {
        const { proyect_id, message } = ctx.params || {};
        const cleanMessage = (message || '').trim();
        const errors = [];
        if (!proyect_id) errors.push('El proyecto es obligatorio.');
        if (cleanMessage.length < 5) errors.push('El mensaje debe tener al menos 5 caracteres.');
        if (errors.length) throw new AppError(400, 'No se pudo enviar la notificación.', errors);

        const proyect = await global.dbc.exeQuery(global.dbc.getSentence('proyectos', 'getProyect'), [proyect_id]);
        if (!proyect.length) throw new AppError(404, 'El proyecto no existe.');

        const sender_user_id = ctx.session && ctx.session.user_id;
        const rows = await global.dbc.exeQuery(global.dbc.getSentence('proyectos', 'sendNotification'),
            [proyect_id, sender_user_id, cleanMessage]);
        return { id: rows[0].id };
    }
};

// Cachea los permisos de la BD en Maps para resolverlos sin volver a consultar.
const Security = class {
    constructor() {
        this.permissionMethodMap = new Map();
        this.permissionOptionMap = new Map();
        this.loadPermissionMethod();
        this.loadPermissionOption();
    }

    // BD -> Map. Key: sub_system_de-object_de-method_de-profile_id, value: true
    async loadPermissionMethod() {
        try {
            const sentence = global.dbc.getSentence('model', 'loadPermissionMethod');
            const rows = await global.dbc.exeQuery(sentence);
            this.permissionMethodMap.clear();
            for (const r of rows) {
                const key = buildKey(r.sub_system_de, r.object_de, r.method_de, r.profile_id);
                this.permissionMethodMap.set(key, true);
            }
            console.log(`Seguridad: ${this.permissionMethodMap.size} permiso(s) de metodo en cache.`);
        } catch (err) {
            console.error('Error en loadPermissionMethod:', err);
        }
    }

    // BD -> Map. Key: profile_id, value: [option_de, ...] = menus visibles del perfil.
    async loadPermissionOption() {
        try {
            const sentence = global.dbc.getSentence('model', 'loadPermissionOption');
            const rows = await global.dbc.exeQuery(sentence);
            this.permissionOptionMap.clear();
            for (const r of rows) {
                if (!this.permissionOptionMap.has(r.profile_id)) {
                    this.permissionOptionMap.set(r.profile_id, []);
                }
                this.permissionOptionMap.get(r.profile_id).push(r.option_de);
            }
            console.log(`Seguridad: ${rows.length} permiso(s) de opcion en cache.`);
        } catch (err) {
            console.error('Error en loadPermissionOption:', err);
        }
    }

    // Consulta el Map (no la BD): ¿el perfil puede ejecutar este metodo?
    getPermissionMethod(j, profile_id) {
        const key = buildKey(j.subsystem, j.objectName, j.methodName, profile_id);
        if (this.permissionMethodMap.has(key)) {
            return this.permissionMethodMap.get(key);
        }
        return false;
    }

    // Consulta el Map (no la BD): menus (option_de) que el perfil puede ver.
    // grant/revokeOption recargan la cache, asi que siempre esta al dia.
    getVisibleOptions(profile_id) {
        return this.permissionOptionMap.get(profile_id) || [];
    }

    // Ejecuta el metodo solicitado. Si es un metodo "rico" (registrado en businessMethods)
    // corre su funcion de servidor; si no, ejecuta la sentencia SQL con los params (simple).
    async exeMethod(j, session) {
        const key = `${j.subsystem}.${j.objectName}.${j.methodName}`;
        const handler = businessMethods[key];

        if (handler) {
            // Metodo rico: funcion de servidor con su propio contexto.
            return await handler({
                params: j.params,
                session,                                    // quien ejecuta (para auditoria futura)
                tx: (fn) => global.dbc.withTransaction(fn)  // helper de transaccion
            });
        }

        // Metodo simple: comportamiento de siempre (1 sentencia con params del cliente).
        const sentence = global.dbc.getSentence(j.subsystem, j.methodName);
        return await global.dbc.exeQuery(sentence, j.params || []);
    }
};

module.exports = Security;
