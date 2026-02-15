"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";

type Message = {
    id: string;
    content: string;
    createdAt: string;
    sender: {
        name: string | null;
        image: string | null;
        avatarUrl: string | null;
    };
    senderId: string;
};

export default function GlobalChat() {
    const { data: session } = useSession();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollDelayRef = useRef(3000);

    const POLL_MIN_MS = 3000;
    const POLL_MAX_MS = 30000;

    const fetchMessages = async (): Promise<boolean> => {
        try {
            const res = await fetch("/api/chat");
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
                return true;
            }
            return false;
        } catch (error) {
            console.error("Failed to fetch messages", error);
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Polling with exponential backoff when chat backend is unavailable
    useEffect(() => {
        let cancelled = false;

        const poll = async () => {
            if (cancelled) return;
            const ok = await fetchMessages();
            if (ok) {
                pollDelayRef.current = POLL_MIN_MS;
            } else {
                pollDelayRef.current = Math.min(pollDelayRef.current * 2, POLL_MAX_MS);
            }

            pollTimerRef.current = setTimeout(poll, pollDelayRef.current);
        };

        poll();

        return () => {
            cancelled = true;
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (isAutoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isAutoScroll]);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const isBottom = scrollHeight - scrollTop - clientHeight < 50;
        setIsAutoScroll(isBottom);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !session) return;

        const content = newMessage;
        setNewMessage(""); // Optimistic clear

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });
            if (res.ok) {
                fetchMessages(); // Refresh immediately
                setIsAutoScroll(true);
            }
        } catch (error) {
            console.error("Failed to send", error);
        }
    };

    if (loading) return <div className="p-4 text-purple-400">Loading chat...</div>;

    return (
        <div className="flex flex-col h-[600px] w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-lg shadow-2xl overflow-hidden backdrop-blur-sm bg-opacity-90">
            {/* Header */}
            <div className="p-3 bg-slate-950 border-b border-purple-500/30">
                <h3 className="text-purple-400 font-bold text-lg flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Universal Echo
                </h3>
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-slate-800"
            >
                {messages.map((msg) => {
                    const isMe = session?.user?.id === msg.senderId;
                    return (
                        <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                            <div className="flex-shrink-0">
                                <Image
                                    src={msg.sender.avatarUrl || msg.sender.image || "/default-avatar.png"}
                                    alt={msg.sender.name || "User"}
                                    width={32}
                                    height={32}
                                    className="rounded-full border border-purple-500/50"
                                />
                            </div>
                            <div className={`flex flex-col max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                                <span className="text-[10px] text-gray-400 mb-1 px-1">
                                    {msg.sender.name || "Unknown"}
                                </span>
                                <div className={`px-3 py-2 rounded-lg text-sm ${isMe
                                    ? "bg-purple-600 text-white rounded-tr-none"
                                    : "bg-slate-800 text-gray-200 border border-slate-700 rounded-tl-none"
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-purple-500/30">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={session ? "Transmit signal..." : "Login to transmit"}
                        disabled={!session}
                        className="flex-1 bg-slate-900 border border-purple-500/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600"
                    />
                    <button
                        type="submit"
                        disabled={!session || !newMessage.trim()}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-bold transition-all shadow-[0_0_10px_rgba(147,51,234,0.3)] hover:shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
}
