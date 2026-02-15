"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileNav() {
    const pathname = usePathname();
    const isActive = (path: string) => pathname === path;

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-white/10 z-50 pb-safe">
            <div className="flex justify-around items-center h-16">
                <MobileNavLink href="/" active={isActive("/")} icon="G" label="Game" />
                <MobileNavLink href="/leaderboard" active={isActive("/leaderboard")} icon="R" label="Rank" />
            </div>
        </div>
    );
}

function MobileNavLink({ href, active, icon, label }: { href: string; active: boolean; icon: string; label: string }) {
    return (
        <Link href={href} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${active ? "text-purple-400" : "text-gray-500 hover:text-gray-300"}`}>
            <span className="text-xl mb-1">{icon}</span>
            <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
        </Link>
    );
}
