'use client';

import { useState } from 'react';

export default function AdminSeedPage() {
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState(false);

    async function runSeed(type: 'static' | 'reset') {
        setLoading(true);
        setStatus('⏳ Running...');
        try {
            const secret = process.env.NEXT_PUBLIC_ADMIN_SECRET || prompt('Enter admin secret:');
            const res = await fetch(`/api/admin/seed?type=${type}&secret=${secret}`);
            const data = await res.json();
            setStatus(data.message || JSON.stringify(data));
        } catch (err) {
            setStatus(`❌ Error: ${err}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-10">
            <h1 className="text-3xl font-bold mb-2">🌱 Admin: Database Seeding</h1>
            <p className="text-slate-400 mb-8">
                Use this to populate or refresh the character database from your CSV file.
            </p>

            <div className="flex gap-4 mb-8">
                <button
                    onClick={() => runSeed('static')}
                    disabled={loading}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold disabled:opacity-50"
                >
                    {loading ? '⏳ Seeding...' : '🔄 Seed / Refresh Characters'}
                </button>
                <button
                    onClick={() => runSeed('reset')}
                    disabled={loading}
                    className="px-6 py-3 bg-red-700 hover:bg-red-800 rounded-lg font-semibold disabled:opacity-50"
                >
                    ⚠️ Force Reset + Re-seed
                </button>
            </div>

            {status && (
                <div className="bg-slate-800 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap">
                    {status}
                </div>
            )}

            <div className="mt-10 text-slate-500 text-sm">
                <p><strong>Seed / Refresh</strong> — Upserts all characters from CSV. Safe to run anytime.</p>
                <p><strong>Force Reset</strong> — Clears the table first, then re-seeds. Use when you&apos;ve removed characters from the CSV.</p>
            </div>
        </div>
    );
}