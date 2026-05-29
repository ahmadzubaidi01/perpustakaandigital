import { create } from 'zustand';

export type SyncState = 'IDLE' | 'OFFLINE' | 'WAITING_NETWORK' | 'SYNCING' | 'RETRYING' | 'SUCCESS' | 'FAILED' | 'CONFLICT';

interface SyncEngineState {
  currentState: SyncState;
  pendingItemsCount: number;
  lastSyncTime: string | null;
  currentOperationId: string | null;
  errorMessage: string | null;

  // Actions
  setState: (state: SyncState) => void;
  setPendingItemsCount: (count: number) => void;
  setLastSyncTime: (time: string) => void;
  setCurrentOperationId: (id: string | null) => void;
  setErrorMessage: (msg: string | null) => void;
}

export const useSyncEngineStore = create<SyncEngineState>((set) => ({
  currentState: 'IDLE',
  pendingItemsCount: 0,
  lastSyncTime: null,
  currentOperationId: null,
  errorMessage: null,

  setState: (state) => set({ currentState: state }),
  setPendingItemsCount: (count) => set({ pendingItemsCount: count }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
  setCurrentOperationId: (id) => set({ currentOperationId: id }),
  setErrorMessage: (msg) => set({ errorMessage: msg }),
}));
