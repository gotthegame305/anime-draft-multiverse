'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import RoomLobby from '@/components/RoomLobby';

export default function RoomPage({ params }: { params: { roomId: string } }) {
    const { data: session } = useSession();
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Use authenticated user ID if available, otherwise generate anonymous ID
        if (session?.user?.id) {
            setUserId(session.user.id);
            setLoading(false);
        } else {
            // Generate and persist anonymous ID
            let anonId = localStorage.getItem('anonUserId');
            if (!anonId) {
                anonId = `anon_${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem('anonUserId', anonId);
            }
            setUserId(anonId);
            setLoading(false);
        }
    }, [session]);

    if (loading || !userId) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-2xl">Loading...</div>
            </div>
        );
    }

    return <RoomLobby roomId={params.roomId} userId={userId} />;
}
