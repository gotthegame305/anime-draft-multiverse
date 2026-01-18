import GlobalChat from "@/components/GlobalChat";

export default function ChatPage() {
    return (
        <main className="min-h-screen bg-slate-950 p-4 pb-24 md:p-8 flex items-center justify-center">
            {/* On desktop, this page might act as a dedicated chat view, 
            but typically users will see the sidebar. 
            On mobile, this is the main view.
        */}
            <div className="w-full max-w-lg">
                <h1 className="text-3xl font-bold text-white mb-6 text-center">Inter-Dimensional Comms</h1>
                <GlobalChat />
            </div>
        </main>
    );
}
