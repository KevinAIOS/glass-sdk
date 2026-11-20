/** Application requirements describe intent; only the Host can grant access. */
export declare const APP_CAPABILITIES: readonly ["aios.input", "aios.display", "aios.microphone", "aios.speaker", "aios.photo", "aios.gallery", "aios.video", "aios.stream", "aios.wifi", "aios.led", "aios.status", "aios.imu"];
export type AppCapability = (typeof APP_CAPABILITIES)[number];
export declare const APP_PERMISSIONS: readonly ["aios.permission.microphone", "aios.permission.camera", "aios.permission.location", "aios.permission.background-location", "aios.permission.notifications.read", "aios.permission.notifications.post", "aios.permission.calendar", "aios.permission.user-data", "aios.permission.location_coarse", "aios.permission.phone_state", "aios.permission.motion", "aios.permission.status", "aios.permission.share_with_developer"];
export type AppPermission = (typeof APP_PERMISSIONS)[number];
export type ExperienceMode = "realtime" | "guardian";
export type ExperienceLeaf = {
    signal: string;
    op: string;
    value?: unknown;
    params?: Record<string, unknown>;
    for_ms?: number;
};
export type ExperienceExpr = {
    all: ExperienceExpr[];
} | {
    any: ExperienceExpr[];
} | {
    not: ExperienceExpr;
} | ExperienceLeaf;
export type ExperienceSubscription = {
    schema_version: "v1alpha";
    id: string;
    when: {
        kind: "signal";
        expr: ExperienceExpr;
        fire?: "enter" | "leave";
    } | {
        kind: "semantic";
        text: string;
    };
};
export interface ExperienceWakeEntry {
    written_by: "developer" | "prompt";
    subscription: ExperienceSubscription;
}
export interface ExperienceExport {
    schema_version: "v1alpha";
    endpoint: string;
    kinds: Array<"event" | "evidence" | "note" | "image">;
}
export interface ExperienceTemplate {
    id: string;
    format: "report";
    sections: Array<{
        heading: string;
        required: boolean;
        blocks: Array<"heading" | "paragraph" | "bullets" | "quote" | "image" | "metric">;
    }>;
}
/** The optional `experience` block of aios.json. Everything here is shown to the user at install. */
export interface ExperienceDeclaration {
    schema_version: "v1alpha";
    mode: ExperienceMode;
    /** Guardian only: at most 8 entries, at most 4 of them semantic. */
    wake_on?: ExperienceWakeEntry[];
    export?: ExperienceExport;
    templates?: ExperienceTemplate[];
}
export declare const EXPERIENCE_LIMITS: {
    readonly wakeEntries: 8;
    readonly semanticWakeEntries: 4;
    readonly templates: 8;
    readonly templateSections: 20;
    readonly exprDepth: 3;
    readonly exprLeaves: 8;
};
export interface AppManifest {
    actions?: {
        id: string;
        description: string;
        parameters?: Record<string, unknown>;
        outputSchema?: Record<string, unknown>;
    }[];
    schema: 1;
    id: string;
    name: string;
    version: string;
    entry: {
        background: string;
        ui?: string;
    };
    capabilities: {
        id: AppCapability;
        required: boolean;
    }[];
    permissions: {
        id: AppPermission;
        reason: string;
    }[];
    /** Present when the app is an Experience. */
    experience?: ExperienceDeclaration;
}
export declare function safeAppPath(value: unknown): value is string;
/** Validates the optional `experience` block against the ExperienceDeclaration contract. */
export declare function defineExperience(input: unknown): ExperienceDeclaration;
export declare function defineApp(input: unknown): AppManifest;
export declare function toHostManifest(input: AppManifest): {
    packageName: string;
    name: string;
    version: string;
    type: string;
    sdkVersion: string;
    minHostVersion: string;
    entry: {
        background: string;
        ui?: string;
    };
    hardwareRequirements: {
        type: string;
        level: string;
    }[];
    permissions: {
        type: string;
        required: boolean;
        description: string;
    }[];
    experience?: ExperienceDeclaration | undefined;
    actions?: {
        id: string;
        description: string;
        parameters?: Record<string, unknown>;
        outputSchema?: Record<string, unknown>;
    }[] | undefined;
};
