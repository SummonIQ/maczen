import { invoke } from "@tauri-apps/api/core";

export type NativeBridgePayload = Record<string, unknown>;

export interface NativeBridgeError {
  code?: string;
  message?: string;
}

export interface NativeBridgeEnvelope<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: NativeBridgeError;
  timing_ms?: number;
}

export interface TauriDesktopBridge {
  nativeBridgeInvoke: <TResponse = unknown>(
    command: string,
    payload?: NativeBridgePayload,
  ) => Promise<TResponse>;
  invokeBridge: <TData = unknown>(
    command: string,
    payload?: NativeBridgePayload,
  ) => Promise<NativeBridgeEnvelope<TData>>;
}

export const createTauriDesktopBridge = (): TauriDesktopBridge => {
  const nativeBridgeInvoke = async <TResponse = unknown>(
    command: string,
    payload: NativeBridgePayload = {},
  ) => {
    return invoke<TResponse>("native_bridge_invoke", { command, payload });
  };

  const invokeBridge = async <TData = unknown>(
    command: string,
    payload: NativeBridgePayload = {},
  ) => {
    return nativeBridgeInvoke<NativeBridgeEnvelope<TData>>(command, payload);
  };

  return {
    nativeBridgeInvoke,
    invokeBridge,
  };
};
