'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Suspense } from 'react';

function SignInContent() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/';
    const error = searchParams.get('error');

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]" />
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />

            <div className="w-full max-w-md z-10">
                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    {/* Top Glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_20px_rgba(59,130,246,0.5)]" />

                    <div className="text-center mb-10">
                        <h1 className="text-4xl font-black text-white italic tracking-tighter mb-2">
                            ADM<span className="text-blue-500">.</span>
                        </h1>
                        <p className="text-slate-400 font-medium">ANIME DRAFT MULTIVERSE</p>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-white text-center mb-6">Authorize Your Mission</h2>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl text-sm text-center mb-6 animate-pulse">
                                {error === 'OAuthSignin' ? 'Connection lost with provider' : 'Authentication failed'}
                            </div>
                        )}

                        <button
                            onClick={() => signIn('google', { callbackUrl })}
                            className="w-full group relative flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-white/5"
                        >
                            <Image src="https://authjs.dev/img/providers/google.svg" alt="Google" width={24} height={24} />
                            CONTINUE WITH GOOGLE
                        </button>

                        <button
                            onClick={() => signIn('discord', { callbackUrl })}
                            className="w-full group relative flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20"
                        >
                            <Image src="https://authjs.dev/img/providers/discord.svg" alt="Discord" width={24} height={24} className="brightness-0 invert" />
                            JOIN VIA DISCORD
                        </button>
                    </div>

                    <div className="mt-10 pt-6 border-t border-slate-800 text-center">
                        <p className="text-xs text-slate-500 font-mono tracking-widest uppercase">
                            Secure Entry Protocol v6.0
                        </p>
                    </div>
                </div>

                <p className="text-center text-slate-500 text-sm mt-8">
                    By entering, you agree to the ADM Terms of Engagement.
                </p>
            </div>
        </div>
    );
}

export default function SignInPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        }>
            <SignInContent />
        </Suspense>
    );
}
