import {MiniappSession} from "../session"
import {MiniappRequestType as Request} from "../protocol"
export type SettingValue = string | number | boolean | null | SettingValue[] | {[key: string]: SettingValue}
/** Persistent preferences belonging to this app. System permissions and Host settings are not writable here. */
export class SettingsModule {
  constructor(private session: MiniappSession) {}
  async get<T extends SettingValue = SettingValue>(key: string): Promise<T | null> {
    return (await this.session.sendRequest<{value: T | null}>({type: Request.SETTINGS_GET, key})).value
  }
  async set(key: string, value: SettingValue): Promise<void> {
    await this.session.sendRequest({type: Request.SETTINGS_SET, key, value})
  }
  async delete(key: string): Promise<void> {await this.session.sendRequest({type: Request.SETTINGS_DELETE, key})}
  async keys(): Promise<string[]> {
    return (await this.session.sendRequest<{keys: string[]}>({type: Request.SETTINGS_LIST})).keys
  }
}
