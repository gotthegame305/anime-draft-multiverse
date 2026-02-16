export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
    return (
        <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8 flex items-center justify-center">
            <div className="max-w-2xl w-full text-center bg-slate-900/70 border border-slate-700 rounded-2xl p-8">
                <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-3">
                    Leaderboard Paused
                </h1>
                <p className="text-slate-300">
                    Leaderboard is temporarily disabled to reduce database usage during stabilization.
                </p>
            </div>
        </main>
    );
}
