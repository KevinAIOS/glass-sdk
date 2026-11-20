/** Application requirements describe intent; only the Host can grant access. */
export const APP_CAPABILITIES = [
    "aios.input",
    "aios.display",
    "aios.microphone",
    "aios.speaker",
    "aios.photo",
    "aios.gallery",
    "aios.video",
    "aios.stream",
    "aios.wifi",
    "aios.led",
    "aios.status",
    "aios.imu",
];
export const APP_PERMISSIONS = [
    "aios.permission.microphone",
    "aios.permission.camera",
    "aios.permission.location",
    "aios.permission.background-location",
    "aios.permission.notifications.read",
    "aios.permission.notifications.post",
    "aios.permission.calendar",
    "aios.permission.user-data",
    // Added with the perception / inbox / output contracts (v1alpha). Additions only.
    "aios.permission.location_coarse",
    "aios.permission.phone_state",
    "aios.permission.motion",
    "aios.permission.status",
    "aios.permission.share_with_developer",
];
export const EXPERIENCE_LIMITS = { wakeEntries: 8, semanticWakeEntries: 4, templates: 8, templateSections: 20, exprDepth: 3, exprLeaves: 8 };
const hardware = {
    "aios.input": ["BUTTON"],
    "aios.display": ["DISPLAY"],
    "aios.microphone": ["MICROPHONE"],
    "aios.speaker": ["SPEAKER"],
    "aios.photo": ["CAMERA"],
    "aios.gallery": [],
    "aios.video": ["CAMERA"],
    // Publication may run on the phone; it does not require a glasses Wi-Fi management API.
    "aios.stream": ["CAMERA"],
    "aios.wifi": ["WIFI"],
    "aios.led": ["LIGHT"],
    "aios.status": [],
    "aios.imu": ["IMU"],
};
const permissionTypes = [
    "MICROPHONE",
    "CAMERA",
    "LOCATION",
    "BACKGROUND_LOCATION",
    "READ_NOTIFICATIONS",
    "POST_NOTIFICATIONS",
    "CALENDAR",
    "USER_DATA",
    // Coarse location is the same OS grant; the rest have no Host consent entry yet and stay declared-only until the Host adds them.
    "LOCATION",
    "PHONE_STATE",
    "MOTION",
    "STATUS",
    "SHARE_WITH_DEVELOPER",
];
export function safeAppPath(value) {
    return (typeof value === "string" &&
        value.length < 200 &&
        /^[a-zA-Z0-9_./-]+$/.test(value) &&
        !value.startsWith("/") &&
        value.split("/").every((part) => part !== "" && part !== "." && part !== ".."));
}
function record(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("invalid_manifest");
    return value;
}
function keys(value, allowed) {
    if (Object.keys(value).some((key) => !allowed.includes(key)))
        throw new Error("invalid_manifest");
}
const SUBSCRIPTION_ID = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const SIGNAL_NAME = /^[a-z]+(\.[a-z_]+)+$/;
const OPERATORS = ["eq", "in", "contains", "lt", "lte", "gt", "gte", "between", "is", "changes"];
const isInt = (v) => typeof v === "number" && Number.isInteger(v);
/** Structural check of a subscription expression; returns the leaf count. Signal names are resolved by the Host against the catalog at install. */
function checkExpr(value, depth) {
    const e = record(value);
    const combinator = ["all", "any", "not"].find((key) => key in e);
    if (combinator) {
        if (Object.keys(e).length !== 1)
            throw new Error("invalid_experience_condition");
        if (depth + 1 > EXPERIENCE_LIMITS.exprDepth)
            throw new Error("invalid_experience_condition");
        if (combinator === "not")
            return checkExpr(e.not, depth + 1);
        const children = e[combinator];
        if (!Array.isArray(children) || children.length < 2 || children.length > 8)
            throw new Error("invalid_experience_condition");
        return children.reduce((count, child) => count + checkExpr(child, depth + 1), 0);
    }
    keys(e, ["signal", "op", "value", "params", "for_ms"]);
    if (typeof e.signal !== "string" || !SIGNAL_NAME.test(e.signal) || !OPERATORS.includes(e.op))
        throw new Error("invalid_experience_condition");
    if (e.value !== undefined) {
        const ok = (typeof e.value === "string" && e.value.length <= 128) || (typeof e.value === "number" && Number.isFinite(e.value)) || typeof e.value === "boolean" ||
            (Array.isArray(e.value) && e.value.length >= 1 && e.value.length <= 32 && e.value.every((v) => typeof v === "string" || typeof v === "number"));
        if (!ok)
            throw new Error("invalid_experience_condition");
    }
    if (e.params !== undefined && Object.keys(record(e.params)).length > 8)
        throw new Error("invalid_experience_condition");
    if (e.for_ms !== undefined && (!isInt(e.for_ms) || e.for_ms < 0 || e.for_ms > 3600000))
        throw new Error("invalid_experience_condition");
    return 1;
}
function checkSubscription(value) {
    const sub = record(value);
    keys(sub, ["schema_version", "id", "when"]);
    if (sub.schema_version !== "v1alpha" || typeof sub.id !== "string" || !SUBSCRIPTION_ID.test(sub.id))
        throw new Error("invalid_experience_subscription");
    const when = record(sub.when);
    if (when.kind === "signal") {
        keys(when, ["kind", "expr", "fire"]);
        if (when.fire !== undefined && when.fire !== "enter" && when.fire !== "leave")
            throw new Error("invalid_experience_subscription");
        if (checkExpr(when.expr, 0) > EXPERIENCE_LIMITS.exprLeaves)
            throw new Error("invalid_experience_condition");
        return "signal";
    }
    if (when.kind === "semantic") {
        keys(when, ["kind", "text"]);
        if (typeof when.text !== "string" || when.text.length < 2 || when.text.length > 500)
            throw new Error("invalid_experience_subscription");
        return "semantic";
    }
    throw new Error("invalid_experience_subscription");
}
/** Validates the optional `experience` block against the ExperienceDeclaration contract. */
export function defineExperience(input) {
    const x = record(input);
    keys(x, ["schema_version", "mode", "wake_on", "export", "templates"]);
    if (x.schema_version !== "v1alpha" || (x.mode !== "realtime" && x.mode !== "guardian"))
        throw new Error("invalid_experience");
    if (x.wake_on !== undefined) {
        // A realtime Experience is opened by the user; only guardians may be woken by a subscription.
        if (x.mode === "realtime")
            throw new Error("realtime_cannot_wake");
        if (!Array.isArray(x.wake_on) || x.wake_on.length < 1 || x.wake_on.length > EXPERIENCE_LIMITS.wakeEntries)
            throw new Error("invalid_experience_wake");
        const ids = new Set();
        let semantic = 0;
        for (const value of x.wake_on) {
            const entry = record(value);
            keys(entry, ["written_by", "subscription"]);
            if (entry.written_by !== "developer" && entry.written_by !== "prompt")
                throw new Error("invalid_experience_wake");
            if (checkSubscription(entry.subscription) === "semantic")
                semantic++;
            const id = String(record(entry.subscription).id);
            if (ids.has(id))
                throw new Error("invalid_experience_wake");
            ids.add(id);
        }
        if (semantic > EXPERIENCE_LIMITS.semanticWakeEntries)
            throw new Error("invalid_experience_wake");
    }
    if (x.export !== undefined) {
        const e = record(x.export);
        keys(e, ["schema_version", "endpoint", "kinds"]);
        if (e.schema_version !== "v1alpha" || typeof e.endpoint !== "string" || !/^https:\/\/[^\s]{4,2000}$/.test(e.endpoint))
            throw new Error("invalid_experience_export");
        const kinds = ["event", "evidence", "note", "image"];
        if (!Array.isArray(e.kinds) || e.kinds.length < 1 || new Set(e.kinds).size !== e.kinds.length || e.kinds.some((k) => !kinds.includes(k)))
            throw new Error("invalid_experience_export");
    }
    if (x.templates !== undefined) {
        if (!Array.isArray(x.templates) || x.templates.length > EXPERIENCE_LIMITS.templates)
            throw new Error("invalid_experience_template");
        const ids = new Set();
        const blockTypes = ["heading", "paragraph", "bullets", "quote", "image", "metric"];
        for (const value of x.templates) {
            const t = record(value);
            keys(t, ["id", "format", "sections"]);
            if (typeof t.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(t.id) || ids.has(t.id) || t.format !== "report")
                throw new Error("invalid_experience_template");
            ids.add(t.id);
            if (!Array.isArray(t.sections) || t.sections.length < 1 || t.sections.length > EXPERIENCE_LIMITS.templateSections)
                throw new Error("invalid_experience_template");
            for (const value of t.sections) {
                const section = record(value);
                keys(section, ["heading", "required", "blocks"]);
                if (typeof section.heading !== "string" || !section.heading.trim() || section.heading.length > 80 || typeof section.required !== "boolean")
                    throw new Error("invalid_experience_template");
                const blocks = section.blocks;
                if (!Array.isArray(blocks) || blocks.length < 1 || new Set(blocks).size !== blocks.length || blocks.some((b) => !blockTypes.includes(b)))
                    throw new Error("invalid_experience_template");
            }
        }
    }
    return JSON.parse(JSON.stringify(x));
}
export function defineApp(input) {
    const m = record(input);
    keys(m, ["schema", "id", "name", "version", "entry", "capabilities", "permissions", "actions", "experience"]);
    if (m.schema !== 1 ||
        typeof m.id !== "string" ||
        !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$/.test(m.id) ||
        m.id.length > 120 ||
        typeof m.name !== "string" ||
        !m.name.trim() ||
        m.name.length > 120 ||
        typeof m.version !== "string" ||
        !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(m.version))
        throw new Error("invalid_manifest");
    const entry = record(m.entry);
    keys(entry, ["background", "ui"]);
    if (!safeAppPath(entry.background) || (entry.ui !== undefined && !safeAppPath(entry.ui)))
        throw new Error("invalid_entry");
    if (!Array.isArray(m.capabilities) || !Array.isArray(m.permissions))
        throw new Error("invalid_manifest");
    const seen = new Set();
    for (const value of m.capabilities) {
        const cap = record(value);
        keys(cap, ["id", "required"]);
        if (!APP_CAPABILITIES.includes(cap.id) ||
            typeof cap.required !== "boolean" ||
            seen.has(String(cap.id)))
            throw new Error("invalid_capability");
        seen.add(String(cap.id));
    }
    for (const value of m.permissions) {
        const p = record(value);
        keys(p, ["id", "reason"]);
        if (!APP_PERMISSIONS.includes(p.id) ||
            typeof p.reason !== "string" ||
            !p.reason.trim() ||
            p.reason.length > 500 ||
            seen.has(String(p.id)))
            throw new Error("invalid_permission");
        seen.add(String(p.id));
    }
    if (m.actions !== undefined) {
        if (!Array.isArray(m.actions) || m.actions.length > 64)
            throw new Error("invalid_actions");
        const ids = new Set();
        for (const value of m.actions) {
            const a = record(value);
            keys(a, ["id", "description", "parameters", "outputSchema"]);
            if (typeof a.id !== "string" || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(a.id) || ids.has(a.id) ||
                typeof a.description !== "string" || !a.description.trim() || a.description.length > 500)
                throw new Error("invalid_action");
            ids.add(a.id);
            for (const schema of [a.parameters, a.outputSchema])
                if (schema !== undefined) {
                    record(schema);
                    if (JSON.stringify(schema).length > 16384)
                        throw new Error("invalid_action_schema");
                }
        }
    }
    if (m.experience !== undefined)
        defineExperience(m.experience);
    return JSON.parse(JSON.stringify(m));
}
export function toHostManifest(input) {
    const m = defineApp(input);
    const requirements = new Map();
    for (const cap of m.capabilities)
        for (const type of hardware[cap.id])
            requirements.set(type, Boolean(requirements.get(type)) || cap.required);
    return {
        ...(m.actions === undefined ? {} : { actions: m.actions }),
        ...(m.experience === undefined ? {} : { experience: m.experience }),
        packageName: m.id,
        name: m.name,
        version: m.version,
        type: "standard",
        sdkVersion: "3.2.0",
        minHostVersion: "3.2.0",
        entry: m.entry,
        hardwareRequirements: [...requirements].map(([type, required]) => ({
            type,
            level: required ? "REQUIRED" : "OPTIONAL",
        })),
        permissions: m.permissions.map((p) => ({
            type: permissionTypes[APP_PERMISSIONS.indexOf(p.id)],
            required: false,
            description: p.reason,
        })),
    };
}
