import DraftGrid from '@/components/DraftGrid';

export default function DraftPage() {
    return (
        <main className="min-h-screen bg-slate-950 bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')]">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-slate-950/80 to-purple-900/20 pointer-events-none" />
            <div className="relative z-10">
                <DraftGrid />
            </div>
        </main>
    );
}
