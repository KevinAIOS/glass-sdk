const pending = new Map();
let sequence = 0, installed = false;
function bridge() {
    const w = window;
    if (!w.ReactNativeWebView)
        throw new Error("host_unavailable");
    if (!installed) {
        w.__aiosDataReply = (reply) => {
            if (reply.id === "revoked") {
                for (const p of pending.values()) {
                    clearTimeout(p.timer);
                    p.reject(new Error("permission_revoked"));
                }
                pending.clear();
                window.dispatchEvent(new Event("aios:data-revoked"));
                return;
            }
            const p = pending.get(reply.id);
            if (!p)
                return;
            pending.delete(reply.id);
            clearTimeout(p.timer);
            if (reply.error)
                p.reject(new Error(reply.error));
            else
                p.resolve(reply.value);
        };
        installed = true;
    }
    return (message) => w.ReactNativeWebView.postMessage(JSON.stringify(message));
}
function task(operation, payload) {
    const id = `data_${Date.now()}_${++sequence}`;
    let send;
    const result = new Promise((resolve, reject) => {
        try {
            send = bridge();
        }
        catch (e) {
            reject(e);
            return;
        }
        const timer = setTimeout(() => {
            pending.delete(id);
            send({ type: "aios-data-v1", id, operation: "cancel" });
            reject(new Error("data_timeout"));
        }, 120000);
        pending.set(id, { resolve: (v) => resolve(v), reject, timer });
        send({ type: "aios-data-v1", id, operation, payload });
    });
    return {
        id,
        result,
        cancel() {
            const p = pending.get(id);
            if (!p)
                return;
            pending.delete(id);
            clearTimeout(p.timer);
            p.reject(new Error("cancelled"));
            send({ type: "aios-data-v1", id, operation: "cancel" });
        },
    };
}
export function requestData(need) {
    return task("query", need);
}
export function readDataSource(requestId, sourceId) {
    return task("source", { requestId, sourceId });
}
/** Revocation also clears this UI's pending requests; consumers must clear rendered data. */
export function revokeData() {
    bridge()({ type: "aios-data-v1", id: "revoke", operation: "revoke" });
}
