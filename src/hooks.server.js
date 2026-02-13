import { db } from '$lib/db';
import crypto from 'node:crypto'; // Correct import for Node.js environments

export async function handle({ event, resolve }) {
    // 1. Filter out noise (favicon, assets, api calls)
    if (event.url.pathname.includes('.') || event.url.pathname.startsWith('/api')) {
        return resolve(event);
    }

    try {
        const ip = event.getClientAddress();
        const ua = event.request.headers.get('user-agent') || '';

        // 2. Generate visitor_id correctly
        const visitor_id = crypto
            .createHash('md5')
            .update(ip + ua)
            .digest('hex');

        const referrer = event.request.headers.get('referer') || 'direct';
        const device = /Mobi|Android/i.test(ua) ? 'mobile' : 'desktop';

        // 3. Use better-sqlite3 syntax (prepare().run())
        const insert = db.prepare(
            'INSERT INTO visits (visitor_id, referrer, device) VALUES (?, ?, ?)'
        );
        insert.run(visitor_id, referrer, device);

    } catch (err) {
        // Log error but don't crash the site for the user
        console.error("Analytics Error:", err);
    }

    return resolve(event);
}
