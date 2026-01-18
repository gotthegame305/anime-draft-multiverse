import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import RoomLobby from '@/components/RoomLobby';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RoomPage({ params }: { params: { roomId: string } }) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        redirect('/api/auth/signin');
    }

    return <RoomLobby roomId={params.roomId} userId={session.user.id} />;
}
