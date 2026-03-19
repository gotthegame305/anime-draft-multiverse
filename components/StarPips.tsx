import React from 'react';

function StarIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
            <path
                fill="currentColor"
                d="m12 2.1 2.72 5.52 6.09.88-4.4 4.29 1.04 6.06L12 16l-5.45 2.85 1.04-6.06-4.4-4.29 6.09-.88L12 2.1Z"
            />
        </svg>
    );
}

export default function StarPips({
    count,
    tone = 'gold',
    className = '',
}: {
    count: number;
    tone?: 'gold' | 'fuchsia' | 'cyan';
    className?: string;
}) {
    const safeCount = Math.max(0, Math.min(count, 6));
    const colorClass = tone === 'fuchsia' ? 'text-fuchsia-950' : tone === 'cyan' ? 'text-cyan-950' : 'text-amber-950';
    const columns = safeCount <= 3 ? safeCount || 1 : 3;

    return (
        <div
            className={`grid gap-[1px] ${className}`}
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
            {Array.from({ length: safeCount }).map((_, index) => (
                <StarIcon key={index} className={`h-2.5 w-2.5 ${colorClass}`} />
            ))}
        </div>
    );
}
