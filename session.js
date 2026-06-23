const session = require('express-session');
const config = require('./config.json');

class Session {
    static initMiddleware(app) {
        if (!app) {
            console.warn('Session.initMiddleware: no se recibió la instancia de "app"; el middleware de sesión no fue inicializado.');
            return;
        }
        app.use(session({
            name: config.session.name,
            secret: config.session.secret,
            resave: config.session.resave,
            saveUninitialized: config.session.saveUninitialized,
            cookie: config.session.cookie
        }));
    }

    constructor(req, db) {
        this.req = req;
        this.db = db;
    }

    sessionExist() {
        if (this.req && this.req.session && this.req.session.objectSession) {
            return true;
        }
        return false;
    }

    // ¿Ya eligió un perfil activo? (En el modelo nuevo el perfil NO viene del login,
    // se elige en la pantalla "Perfiles" porque un usuario puede tener varios.)
    hasActiveProfile() {
        return this.sessionExist() && this.req.session.objectSession.profile_id != null;
    }

    async authenticate(user_na, user_pw) {
        try {
            const sentence = this.db.getSentence('security', 'getUser');
            const rows = await this.db.exeQuery(sentence, [user_na, user_pw]);
            if (rows.length === 0) return null;
            return rows[0];   // { user_id, user_na, user_pw, status_id }  (ya NO trae profile_id)
        } catch (err) {
            console.error('Error en authenticate:', err);
            throw err;
        }
    }

    // Perfiles que tiene asignado el usuario (tabla puente user_profile, relacion M:N).
    async getProfiles(user_id) {
        try {
            const sentence = this.db.getSentence('security', 'listUserProfiles');
            return await this.db.exeQuery(sentence, [user_id]);   // [{ profile_id, profile_de }, ...]
        } catch (err) {
            console.error('Error en getProfiles:', err);
            throw err;
        }
    }

    // Crea la sesion SIN perfil activo todavia: profile_id queda null hasta elegirlo.
    createSession(user) {
        try {
            this.req.session.objectSession = {
                "user_id": user.user_id,
                "user_na": user.user_na,
                "status_id": user.status_id,
                "profile_id": null,     // se fija con setActiveProfile (pantalla "Perfiles")
                "profile_de": null
            };
            return true;
        } catch (err) {
            console.error('Error en createSession:', err);
            throw err;
        }
    }

    // Fija el perfil activo. profile = { profile_id, profile_de }.
    setActiveProfile(profile) {
        try {
            if (!this.sessionExist()) return false;
            this.req.session.objectSession.profile_id = profile.profile_id;
            this.req.session.objectSession.profile_de = profile.profile_de;
            return true;
        } catch (err) {
            console.error('Error en setActiveProfile:', err);
            throw err;
        }
    }

    destroySession() {
        return new Promise((resolve, reject) => {
            try {
                this.req.session.destroy((err) => {
                    if (err) return reject(err);
                    resolve();
                });
            } catch (err) {
                console.error('Error en destroySession:', err);
                reject(err);
            }
        });
    }

    getDataSession() {
        try {
            if (!this.sessionExist()) return null;
            return this.req.session.objectSession;
        } catch (err) {
            console.error('Error en getDataSession:', err);
            return null;
        }
    }

    // login: autentica y devuelve los perfiles del usuario. NO elige perfil activo:
    // de eso se encarga el servidor (auto si hay uno solo, o pantalla "Perfiles" si hay varios).
    async login(user_na, user_pw) {
        try {
            const user = await this.authenticate(user_na, user_pw);
            if (!user) {
                return { "ok": false, "msg": 'Credenciales inválidas.' };
            }
            this.createSession(user);
            const profiles = await this.getProfiles(user.user_id);
            return { "ok": true, "profiles": profiles, "data": this.getDataSession() };
        } catch (err) {
            console.error('Error en login:', err);
            return { "ok": false, "msg": 'Error interno del servidor.' };
        }
    }

    async logout() {
        try {
            await this.destroySession();
            return { "ok": true };
        } catch (err) {
            console.error('Error en logout:', err);
            return { "ok": false, "msg": 'Error al cerrar sesión.' };
        }
    }
}

module.exports = Session;
