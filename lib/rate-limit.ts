type Entry = {
    count: number;
    resetAt: number;
};

const store = new Map<string, Entry>();

export function isRateLimited(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const current = store.get(key);

    if (!current || now > current.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return false;
    }

    if (current.count >= limit) {
        return true;
    }

    current.count += 1;
    store.set(key, current);
    return false;
}

export function getClientIp(req: Request) {
    const xfwd = req.headers.get('x-forwarded-for');
    if (!xfwd) return 'unknown';
    return xfwd.split(',')[0]?.trim() || 'unknown';
}
