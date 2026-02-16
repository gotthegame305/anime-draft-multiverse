"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function NavBar() {
    const { data: session } = useSession();
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="sticky top-0 z-50 w-full bg-slate-950/80 backdrop-blur-md border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex-shrink-0">
                        <Link href="/" className="flex items-center gap-2">
                            <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 tracking-tighter hover:opacity-80 transition-opacity">
                                ADM
                            </span>
                        </Link>
                    </div>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center space-x-8">
                        <NavLink href="/" active={isActive("/")}>Play Game</NavLink>
                    </div>

                    {/* User Area */}
                    <div className="flex items-center gap-4">
                        {session ? (
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Image
                                        src={session.user?.image || "/default-avatar.png"}
                                        alt="User"
                                        width={32}
                                        height={32}
                                        className="rounded-full border border-purple-500/50"
                                    />
                                    <span className="text-sm font-medium text-gray-300 hidden sm:block">
                                        {session.user?.name}
                                    </span>
                                </div>
                                <button
                                    onClick={() => signOut()}
                                    className="text-sm text-gray-400 hover:text-white transition-colors"
                                >
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => signIn()}
                                className="px-4 py-2 text-sm font-bold bg-white text-slate-900 rounded-full hover:bg-gray-200 transition-colors"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className={`relative text-sm font-medium transition-colors ${active ? "text-white" : "text-gray-400 hover:text-white"
                }`}
        >
            {children}
            {active && (
                <span className="absolute -bottom-[21px] left-0 w-full h-[2px] bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
            )}
        </Link>
    );
}
