import { getLeaderboard } from "@/lib/actions";
import LeaderboardList from "@/components/LeaderboardList";

// Force dynamic since leaderboard changes frequently
export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
    const users = await getLeaderboard();

    return (
        <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-4 tracking-tight">
                        MULTIVERSE RANKINGS
                    </h1>
                    <p className="text-gray-400 text-lg">Top dimension drifters across the universe</p>
                </div>

                <LeaderboardList users={users} />
            </div>
        </main>
    );
}
