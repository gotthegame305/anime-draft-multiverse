import React from 'react';

type LeaderboardUser = {
    username: string;
    avatarUrl: string;
    wins: number;
    losses: number;
};

export default function LeaderboardList({ users }: { users: LeaderboardUser[] }) {
    const topThree = users.slice(0, 3);
    const rest = users.slice(3);

    const getWinRate = (wins: number, losses: number) => {
        const total = wins + losses;
        if (total === 0) return 0;
        return ((wins / total) * 100).toFixed(1);
    };

    const getRankStyle = (index: number) => {
        switch (index) {
            case 0: return "border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)] bg-gradient-to-b from-yellow-900/20 to-slate-900"; // Gold
            case 1: return "border-slate-400 shadow-[0_0_20px_rgba(148,163,184,0.3)] bg-gradient-to-b from-slate-700/20 to-slate-900"; // Silver
            case 2: return "border-amber-700 shadow-[0_0_20px_rgba(180,83,9,0.3)] bg-gradient-to-b from-amber-900/20 to-slate-900"; // Bronze
            default: return "border-slate-700 bg-slate-800";
        }
    };

    const getRankIcon = (index: number) => {
        switch (index) {
            case 0: return "👑";
            case 1: return "🥈";
            case 2: return "🥉";
            default: return `#${index + 1}`;
        }
    };

    return (
        <div className="space-y-8">
            {/* Top 3 Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
                {/* Reorder for visual hierarchy: 2 (Silver), 1 (Gold), 3 (Bronze) */}
                {[topThree[1], topThree[0], topThree[2]].map((user, i) => {
                    if (!user) return null;
                    // Correct index mapping back to original 0, 1, 2
                    const rankIndex = i === 1 ? 0 : i === 0 ? 1 : 2;

                    return (
                        <div key={user.username} className={`relative p-6 rounded-xl border-2 flex flex-col items-center ${getRankStyle(rankIndex)} transform transition-transform hover:scale-105 ${rankIndex === 0 ? "h-64 justify-center md:-mt-8 z-10 scale-110" : "h-48 justify-center"}`}>
                            <div className="absolute -top-4 bg-slate-900 border border-slate-700 rounded-full px-3 py-1 text-xl font-bold">
                                {getRankIcon(rankIndex)}
                            </div>
                            <img
                                src={user.avatarUrl}
                                alt={user.username}
                                className={`rounded-full object-cover mb-3 border-2 ${rankIndex === 0 ? "w-24 h-24 border-yellow-400" : "w-16 h-16 border-slate-500"}`}
                            />
                            <h3 className="text-xl font-bold text-white truncate max-w-full">{user.username}</h3>
                            <div className="mt-2 text-center text-sm">
                                <p className="text-purple-400 font-bold">{user.wins} Wins</p>
                                <p className="text-gray-400">{getWinRate(user.wins, user.losses)}% WR</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* The Rest */}
            <div className="space-y-2">
                {rest.map((user, index) => (
                    <div key={user.username} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors">
                        <div className="flex items-center gap-4">
                            <span className="text-gray-500 font-mono w-8 text-center">{index + 4}</span>
                            <img src={user.avatarUrl} alt={user.username} className="w-10 h-10 rounded-full border border-slate-600" />
                            <span className="font-semibold text-white">{user.username}</span>
                        </div>
                        <div className="flex gap-6 text-right">
                            <div className="w-20">
                                <span className="block text-white font-bold">{user.wins}</span>
                                <span className="text-xs text-gray-500">Wins</span>
                            </div>
                            <div className="w-20">
                                <span className="block text-green-400 font-bold">{getWinRate(user.wins, user.losses)}%</span>
                                <span className="text-xs text-gray-500">Win Rate</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
