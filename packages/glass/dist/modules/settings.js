import { MiniappRequestType as Request } from "../protocol";
/** Persistent preferences belonging to this app. System permissions and Host settings are not writable here. */
export class SettingsModule {
    constructor(session) {
        this.session = session;
    }
    async get(key) {
        return (await this.session.sendRequest({ type: Request.SETTINGS_GET, key })).value;
    }
    async set(key, value) {
        await this.session.sendRequest({ type: Request.SETTINGS_SET, key, value });
    }
    async delete(key) { await this.session.sendRequest({ type: Request.SETTINGS_DELETE, key }); }
    async keys() {
        return (await this.session.sendRequest({ type: Request.SETTINGS_LIST })).keys;
    }
}
