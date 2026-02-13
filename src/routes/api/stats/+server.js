import { db } from '$lib/db';
import { json } from '@sveltejs/kit';

export async function GET({ request }) {
    // 1. Security Check
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== 'kuku') {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        // 2. Hourly Stats (Last 24 Hours)
        const hourly = db.prepare(`
            SELECT
                strftime('%H:00', timestamp, 'localtime') as time,
                COUNT(*) as total,
                COUNT(DISTINCT visitor_id) as unique_users
            FROM visits
            WHERE timestamp > datetime('now', '-24 hours')
            GROUP BY time ORDER BY time ASC
        `).all();

        // 3. Daily Stats (Last 30 Days)
        const daily = db.prepare(`
            SELECT
                date(timestamp, 'localtime') as time,
                COUNT(*) as total,
                COUNT(DISTINCT visitor_id) as unique_users
            FROM visits
            WHERE timestamp > date('now', '-30 days')
            GROUP BY time ORDER BY time ASC
        `).all();

        // 4. Monthly Stats (Last 12 Months)
        const monthly = db.prepare(`
            SELECT
                strftime('%Y-%m', timestamp, 'localtime') as time,
                COUNT(*) as total,
                COUNT(DISTINCT visitor_id) as unique_users
            FROM visits
            WHERE timestamp > date('now', '-12 months')
            GROUP BY time ORDER BY time ASC
        `).all();

        // 5. Global Summary
        const summary = db.prepare(`
            SELECT
                COUNT(*) as total_ever,
                COUNT(DISTINCT visitor_id) as unique_ever
            FROM visits
        `).get();

        return json({
            summary,
            hourly,
            daily,
            monthly
        });

    } catch (err) {
        console.error("Stats API Error:", err);
        return json({ error: "Database query failed" }, { status: 500 });
    }
}
