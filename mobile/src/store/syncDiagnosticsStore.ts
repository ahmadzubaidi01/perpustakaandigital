import { create } from 'zustand';

export interface SyncFailure {
  timestamp: string;
  operation: string;
  errorMessage: string;
}

export interface SyncDiagnosticsState {
  // Websocket status
  isWebsocketStable: boolean;
  websocketDisconnects: number;

  // Queue Health
  pendingQueueSize: number;
  failedQueueSize: number;
  queueProcessingLatencyMs: number; // Avg time to process a queued transaction

  // Sync health
  lastSuccessfulSyncAt: string | null;
  syncBacklogGrowthCount: number;
  syncRetryCount: number;
  isSyncing: boolean;

  // Network & Requests
  avgApiResponseTimeMs: number;
  apiResponseDegradation: boolean; // true if avg response time > 1500ms
  requestBurstCount: number;
  realtimeEventCount: number;
  isOfflineSyncRecoveryActive: boolean;

  // Failures
  recentFailures: SyncFailure[];

  // Actions
  setWebsocketStability: (stable: boolean) => void;
  incrementWebsocketDisconnects: () => void;
  updateQueueHealth: (pending: number, failed: number) => void;
  recordQueueLatency: (latencyMs: number) => void;
  recordSyncSuccess: () => void;
  recordSyncStart: (active: boolean) => void;
  incrementSyncRetries: () => void;
  recordApiResponseTime: (responseTimeMs: number) => void;
  incrementRequestBurst: () => void;
  incrementRealtimeEvents: () => void;
  setOfflineSyncRecovery: (active: boolean) => void;
  logSyncFailure: (operation: string, errorMessage: string) => void;
  resetDiagnostics: () => void;
}

export const useSyncDiagnosticsStore = create<SyncDiagnosticsState>((set, get) => ({
  isWebsocketStable: true,
  websocketDisconnects: 0,
  pendingQueueSize: 0,
  failedQueueSize: 0,
  queueProcessingLatencyMs: 0,
  lastSuccessfulSyncAt: null,
  syncBacklogGrowthCount: 0,
  syncRetryCount: 0,
  isSyncing: false,
  avgApiResponseTimeMs: 200, // baseline
  apiResponseDegradation: false,
  requestBurstCount: 0,
  realtimeEventCount: 0,
  isOfflineSyncRecoveryActive: false,
  recentFailures: [],

  setWebsocketStability: (isWebsocketStable) => set({ isWebsocketStable }),

  incrementWebsocketDisconnects: () => set((state) => ({
    websocketDisconnects: state.websocketDisconnects + 1,
    isWebsocketStable: false
  })),

  updateQueueHealth: (pendingQueueSize, failedQueueSize) => set((state) => {
    // If pending size is growing larger than previous, track backlog growth
    const growth = pendingQueueSize > state.pendingQueueSize 
      ? state.syncBacklogGrowthCount + (pendingQueueSize - state.pendingQueueSize)
      : state.syncBacklogGrowthCount;
    return { pendingQueueSize, failedQueueSize, syncBacklogGrowthCount: growth };
  }),

  recordQueueLatency: (latencyMs) => set((state) => {
    const avg = state.queueProcessingLatencyMs === 0 
      ? latencyMs 
      : Math.round((state.queueProcessingLatencyMs * 4 + latencyMs) / 5); // moving avg
    return { queueProcessingLatencyMs: avg };
  }),

  recordSyncSuccess: () => set({
    lastSuccessfulSyncAt: new Date().toISOString(),
    syncRetryCount: 0,
    isSyncing: false
  }),

  recordSyncStart: (isSyncing) => set({ isSyncing }),

  incrementSyncRetries: () => set((state) => ({
    syncRetryCount: state.syncRetryCount + 1
  })),

  recordApiResponseTime: (responseTimeMs) => set((state) => {
    const avg = Math.round((state.avgApiResponseTimeMs * 9 + responseTimeMs) / 10); // 10-period moving average
    const degradation = avg > 1500;
    return { avgApiResponseTimeMs: avg, apiResponseDegradation: degradation };
  }),

  incrementRequestBurst: () => set((state) => ({
    requestBurstCount: state.requestBurstCount + 1
  })),

  incrementRealtimeEvents: () => set((state) => ({
    realtimeEventCount: state.realtimeEventCount + 1
  })),

  setOfflineSyncRecovery: (isOfflineSyncRecoveryActive) => set({ isOfflineSyncRecoveryActive }),

  logSyncFailure: (operation, errorMessage) => set((state) => {
    const failure: SyncFailure = {
      timestamp: new Date().toISOString(),
      operation,
      errorMessage
    };
    // Cap failure logs to recent 10 items
    const recent = [failure, ...state.recentFailures].slice(0, 10);
    return { recentFailures: recent };
  }),

  resetDiagnostics: () => set({
    websocketDisconnects: 0,
    queueProcessingLatencyMs: 0,
    syncBacklogGrowthCount: 0,
    syncRetryCount: 0,
    requestBurstCount: 0,
    realtimeEventCount: 0,
    recentFailures: []
  })
}));
