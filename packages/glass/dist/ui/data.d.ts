/** Optional local-data access in an ordinary MiniApp UI. All access is authorized by the Host. */
export type DataSchema = {
    type: "object" | "array" | "string" | "number" | "boolean" | "null";
    properties?: Record<string, DataSchema>;
    required?: string[];
    items?: DataSchema;
    maxItems?: number;
    maxLength?: number;
    additionalProperties?: false;
};
export type DataNeed = {
    need: string;
    purpose: string;
    schema: DataSchema;
};
export type DataSource = {
    id: string;
    scopeId: string;
    title: string;
};
export type DataResult<T = unknown> = {
    requestId: string;
    identity: {
        user: string;
        app: string;
        version: string;
        session: string;
    };
    updatedAt: string;
    data: T;
    sources: DataSource[];
    warnings: string[];
};
export type SourceContent = {
    requestId: string;
    sourceId: string;
    text: string;
};
export type DataTask<T> = {
    id: string;
    result: Promise<T>;
    cancel(): void;
};
export declare function requestData<T = unknown>(need: DataNeed): DataTask<DataResult<T>>;
export declare function readDataSource(requestId: string, sourceId: string): DataTask<SourceContent>;
/** Revocation also clears this UI's pending requests; consumers must clear rendered data. */
export declare function revokeData(): void;
