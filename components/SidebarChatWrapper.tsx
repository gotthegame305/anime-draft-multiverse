"use client";

import GlobalChat from "@/components/GlobalChat";
import { usePathname } from "next/navigation";

export default function SidebarChatWrapper() {
    const pathname = usePathname();

    // Hide sidebar where dedicated/in-page chat already exists
    if (
        pathname === "/chat" ||
        pathname.startsWith("/game/") ||
        pathname.startsWith("/room/")
    ) {
        return null;
    }

    return (
        <div className="hidden lg:block fixed right-6 bottom-6 z-40 w-80 pointer-events-none">
            <div className="pointer-events-auto shadow-2xl rounded-lg overflow-hidden">
                <GlobalChat />
            </div>
        </div>
    );
}
