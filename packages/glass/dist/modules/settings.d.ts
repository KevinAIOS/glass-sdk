import { MiniappSession } from "../session";
export type SettingValue = string | number | boolean | null | SettingValue[] | {
    [key: string]: SettingValue;
};
/** Persistent preferences belonging to this app. System permissions and Host settings are not writable here. */
export declare class SettingsModule {
    private session;
    constructor(session: MiniappSession);
    get<T extends SettingValue = SettingValue>(key: string): Promise<T | null>;
    set(key: string, value: SettingValue): Promise<void>;
    delete(key: string): Promise<void>;
    keys(): Promise<string[]>;
}
