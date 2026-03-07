import { getCharacters } from '@/app/actions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import DraftGame from '@/components/DraftGame'

export const dynamic = 'force-dynamic'

export default async function GamePage() {
    const [characters, session] = await Promise.all([
        getCharacters(),
        getServerSession(authOptions),
    ])

    // Guests (not logged in) get null — they can still play but stats won't be recorded
    const userId = session?.user?.id ?? undefined

    return <DraftGame initialCharacters={characters} userId={userId} />
}
