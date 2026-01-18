'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import RoomLobby from '@/components/RoomLobby';

export default function RoomPage({ params }: { params: { roomId: string } }) {
    const { data: session } = useSession();

    if (!session?.user?.id) {
        redirect('/api/auth/signin');
    }

    return <RoomLobby roomId={params.roomId} userId={session.user.id} />;
}
