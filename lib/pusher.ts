import Pusher from 'pusher';

export const pusherServer = new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER!,
    useTLS: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function triggerRoomEvent(roomId: string, event: string, data: any) {
    await pusherServer.trigger(`room-${roomId}`, event, data);
}
