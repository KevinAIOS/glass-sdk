import type { Transport } from "./types";
export interface CreateTransportOptions {
    transport?: Transport;
    /** Explicit development connection; never falls back to simulated success. */
    localSocketUrl?: string;
}
export declare function createTransport(options?: CreateTransportOptions): Transport;
