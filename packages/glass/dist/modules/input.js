/**
 * @fileoverview InputModule — physical control events on the glasses.
 *
 * Combines button + touch surfaces. Future input modes (gesture, voice
 * command, eye tracking) will extend this module rather than spawning new
 * top-level modules.
 *
 * Touch overloads:
 *
 *   session.input.onTouch(handler)
 *   session.input.onTouch("single_tap", handler)
 *   session.input.onTouch(["swipe_up", "swipe_down"], handler)
 *
 * Per-gesture filtering rides on `touch_event:<gesture>` stream variants
 * the phone runtime fans out alongside the bare `touch_event` stream.
 */
import { MiniappStreamType } from "../protocol";
export class InputModule {
    constructor(session) {
        this.session = session;
    }
    /** Normalized gestures delivered only to the app holding glance input focus. */
    onAction(handler) {
        return this.session._subscribe(MiniappStreamType.SEMANTIC_ACTION, handler);
    }
    /** Reports only this app's focus; another app's identity is never disclosed. */
    onFocusChange(handler) {
        return this.session._subscribe(MiniappStreamType.INPUT_FOCUS, handler);
    }
    onButtonPress(handler) {
        return this.session._subscribe(MiniappStreamType.BUTTON_PRESS, handler);
    }
    onTouch(gestureOrHandler, maybeHandler) {
        // Plain handler — subscribe to all touches.
        if (typeof gestureOrHandler === "function") {
            return this.session._subscribe(MiniappStreamType.TOUCH_EVENT, gestureOrHandler);
        }
        const handler = maybeHandler;
        const gestures = Array.isArray(gestureOrHandler) ? gestureOrHandler : [gestureOrHandler];
        if (gestures.length === 0)
            return () => { };
        const unsubs = [];
        for (const g of gestures) {
            unsubs.push(this.session._subscribe(`${MiniappStreamType.TOUCH_EVENT}:${g}`, handler));
        }
        return () => {
            for (const u of unsubs) {
                try {
                    u();
                }
                catch {
                    /* ignore */
                }
            }
        };
    }
}
