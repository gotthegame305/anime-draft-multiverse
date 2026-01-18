import Link from 'next/link';
import Leaderboard from '@/components/Leaderboard';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-slate-950 text-white overflow-hidden relative">

      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950" />

      <div className="relative z-10 text-center space-y-8">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 animate-gradient-x drop-shadow-2xl">
          ANIME DRAFT
          <br />
          <span className="text-4xl md:text-6xl text-white opacity-90 stroke-current">MULTIVERSE</span>
        </h1>

        <p className="text-xl text-indigo-200 max-w-2xl mx-auto font-light leading-relaxed">
          Assemble your dream team from across the anime dimensions.
          Battle for supremacy in the ultimate draft showdown.
        </p>

        <Link
          href="/draft"
          className="inline-block group relative px-12 py-5 bg-white text-slate-950 font-black text-xl tracking-wider rounded-full overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
        >
          <span className="relative z-10">ENTER THE DRAFT</span>
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-20 transition-opacity" />
        </Link>
      </div>

      <div className="relative z-10 w-full px-4 mt-8">
        <Leaderboard />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-1/4 left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-blob" />
      <div className="absolute bottom-1/4 right-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
    </main>
  );
}
