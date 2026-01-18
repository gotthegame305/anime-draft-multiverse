import Pusher from 'pusher';

const pusherAppId = process.env.PUSHER_APP_ID;
const pusherKey = process.env.PUSHER_KEY;
const pusherSecret = process.env.PUSHER_SECRET;
const pusherCluster = process.env.PUSHER_CLUSTER || 'us2';

export const pusherServer = (pusherAppId && pusherKey && pusherSecret)
    ? new Pusher({
        appId: pusherAppId,
        key: pusherKey,
        secret: pusherSecret,
        cluster: pusherCluster,
        useTLS: true,
    })
    : null;

if (!pusherServer) {
    console.warn("[PUSHER] Server initialization skipped: Missing environment variables.");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function triggerRoomEvent(roomId: string, event: string, data: any) {
    if (!pusherServer) {
        console.warn(`[PUSHER] Skipping event '${event}' for room '${roomId}': Server not initialized.`);
        return;
    }

    try {
        // Strip large data for Pusher broadcasts to stay under 10KB limit
        const broadcastData = { ...data };
        if (broadcastData.characterPool) {
            delete broadcastData.characterPool;
        }

        await pusherServer.trigger(`room-${roomId}`, event, broadcastData);
    } catch (error) {
        console.error(`[PUSHER] Error triggering event '${event}':`, error);
        // We log the error but don't rethrow, to prevent 500ing the API route
        // if just the broadcast fails. Identity sync (DB) remains the source of truth.
    }
}
