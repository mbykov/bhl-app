import { db } from '$lib/db';
import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';

export async function POST({ request, getClientAddress }) {
    try {
        const body = await request.json().catch(() => ({}));
        const { referrer = 'direct', device = 'unknown' } = body;

        const ip = getClientAddress();
        const ua = request.headers.get('user-agent') || '';
        const visitor_id = crypto.createHash('md5').update(ip + ua).digest('hex');

        // Execute the insert
        db.prepare(
            'INSERT INTO visits (visitor_id, referrer, device) VALUES (?, ?, ?)'
        ).run(visitor_id, referrer, device);

        // ALWAYS return a response, even if empty
        return json({ success: true }, { status: 201 });
    } catch (err) {
        console.error("Collect Error:", err);
        return json({ error: err.message }, { status: 500 });
    }
}
