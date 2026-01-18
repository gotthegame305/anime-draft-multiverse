'use client';

import Pusher from 'pusher-js';

const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

export const pusherClient = pusherKey
    ? new Pusher(pusherKey, { cluster: pusherCluster || 'mt1' })
    : null;

if (!pusherClient) {
    console.warn("Pusher client skip: NEXT_PUBLIC_PUSHER_KEY not found.");
} else {
    pusherClient.connection.bind('connected', () => {
        console.log('[PUSHER] Connected to real-time service');
    });
    pusherClient.connection.bind('error', (err: unknown) => {
        console.error('[PUSHER] Connection error:', err);
    });
    pusherClient.connection.bind('disconnected', () => {
        console.warn('[PUSHER] Disconnected');
    });
}

export function subscribeToRoom(roomId: string) {
    if (!pusherClient) return null;
    return pusherClient.subscribe(`room-${roomId}`);
}

export function unsubscribeFromRoom(roomId: string) {
    if (!pusherClient) return;
    pusherClient.unsubscribe(`room-${roomId}`);
}
