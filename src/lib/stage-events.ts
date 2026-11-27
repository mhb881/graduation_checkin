import { EventEmitter } from "node:events";

export interface StageSnapshot {
  currentOnStage: {
    id: number;
    code: string;
    name: string;
    email: string;
    calledAt: string | null;
    calledByName: string | null;
  } | null;
  waitingQueue: Array<{
    id: number;
    code: string;
    name: string;
    queuedAt: string;
    queuedByName: string | null;
  }>;
  recentCompleted: Array<{
    id: number;
    code: string;
    name: string;
    completedAt: string | null;
  }>;
  stats: {
    totalRegistered: number;
    checkedInCount: number;
    notCheckedInCount: number;
    waitingCount: number;
    onStageCount: number;
    completedCount: number;
  };
  updatedAt: string;
}

const globalForEvents = globalThis as unknown as {
  __stageEmitter?: EventEmitter;
};

function getEmitter(): EventEmitter {
  if (!globalForEvents.__stageEmitter) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    globalForEvents.__stageEmitter = emitter;
  }
  return globalForEvents.__stageEmitter;
}

const STAGE_UPDATE_EVENT = "stage:update";

export function publishStageSnapshot(snapshot: StageSnapshot): void {
  getEmitter().emit(STAGE_UPDATE_EVENT, snapshot);
}

export function subscribeStageSnapshot(
  listener: (snapshot: StageSnapshot) => void
): () => void {
  const emitter = getEmitter();
  emitter.on(STAGE_UPDATE_EVENT, listener);
  return () => {
    emitter.off(STAGE_UPDATE_EVENT, listener);
  };
}
