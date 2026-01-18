import { getLeaderboard } from '@/app/actions';
import Image from 'next/image';

export default async function Leaderboard() {
    const users = await getLeaderboard();

    return (
        <div className="w-full max-w-4xl mx-auto p-6 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                <span className="text-yellow-400">🏆</span>
                ELITE RANKINGS
            </h2>

            {users.length === 0 ? (
                <div className="text-center py-10 text-slate-500 font-mono">
                    NO DATA FOUND. BE THE FIRST CHAMPION.
                </div>
            ) : (
                <div className="space-y-3">
                    {users.map((user: any, index: number) => (
                        <div
                            key={user.id}
                            className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700 hover:border-blue-500 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="font-mono text-xl font-bold text-slate-400 w-8 text-center">
                                    #{index + 1}
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Placeholder for avatar if empty */}
                                    <div className="w-10 h-10 rounded-full bg-slate-600 overflow-hidden relative">
                                        {user.avatarUrl && (
                                            <Image
                                                src={user.avatarUrl}
                                                alt={user.username || 'User'}
                                                fill
                                                className="object-cover"
                                            />
                                        )}
                                    </div>
                                    <span className="font-bold text-white text-lg">{user.username}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 font-mono">
                                <div className="text-green-400">
                                    <span className="text-xs text-slate-500 uppercase mr-1">W</span>
                                    {user.wins}
                                </div>
                                <div className="text-red-400">
                                    <span className="text-xs text-slate-500 uppercase mr-1">L</span>
                                    {user.losses}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
