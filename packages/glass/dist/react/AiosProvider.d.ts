/**
 * @fileoverview AiosProvider — optional root provider for miniapp apps.
 *
 * Opt-in conveniences that would otherwise require boilerplate in every
 * miniapp. Currently:
 *   - Keeps `<html class="dark">` in sync with the host's color scheme so the
 *     shared theme CSS switches automatically.
 *
 * Usage:
 *   createRoot(root).render(
 *     <AiosProvider>
 *       <App />
 *     </AiosProvider>
 *   )
 *
 * Each convenience is controllable via props so miniapps that manage these
 * things themselves can opt out without forking the provider.
 */
import { type ReactNode } from "react";
export interface AiosProviderProps {
    children: ReactNode;
    /**
     * Toggle `document.documentElement.classList` "dark" to match the host's
     * current color scheme. The toggle runs synchronously during render so
     * children paint with the correct class on first mount — no flash.
     *
     * Default: true. Set to false if your app owns the `dark` class itself
     * (e.g. you integrate a theming library like next-themes).
     */
    syncColorScheme?: boolean;
}
export declare function AiosProvider({ children, syncColorScheme }: AiosProviderProps): import("react").JSX.Element;
