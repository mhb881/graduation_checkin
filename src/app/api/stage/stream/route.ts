import { db } from "@/db";
import { getPublicDisplayState, getStageSnapshot } from "@/lib/graduation-service";
import { getServerSessionActor } from "@/lib/session";
import { subscribeStageSnapshot, type StageSnapshot } from "@/lib/stage-events";

function toPublicPayload(snapshot: StageSnapshot) {
  return {
    currentOnStage: snapshot.currentOnStage
      ? {
          code: snapshot.currentOnStage.code,
          name: snapshot.currentOnStage.name,
          calledAt: snapshot.currentOnStage.calledAt,
        }
      : null,
    nextInQueue: snapshot.waitingQueue[0]
      ? {
          code: snapshot.waitingQueue[0].code,
          name: snapshot.waitingQueue[0].name,
        }
      : null,
    waitingCount: snapshot.stats.waitingCount,
    completedCount: snapshot.stats.completedCount,
    updatedAt: snapshot.updatedAt,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const actor = scope === "public" ? null : await getServerSessionActor(request.headers);
  const isStaff = Boolean(actor);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      const sendSnapshot = (snapshot: StageSnapshot) => {
        sendEvent("stage", isStaff ? snapshot : toPublicPayload(snapshot));
      };

      try {
        if (isStaff) {
          const initial = await getStageSnapshot(db);
          sendEvent("stage", initial);
        } else {
          const initialPublic = await getPublicDisplayState(db);
          sendEvent("stage", initialPublic);
        }
      } catch {
        // Ignore initial fetch error; client will retry automatically
      }

      const unsubscribe = subscribeStageSnapshot((snapshot) => {
        sendSnapshot(snapshot);
      });

      const keepAliveTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {
          closed = true;
        }
      }, 15_000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(keepAliveTimer);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
