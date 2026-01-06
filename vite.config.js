import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],
    // server: {
    //     fs: {
    //         allow: ['.', './public', './src'] // Allow serving from these directories
    //     }
    // },
    server: {
        // port: 443,
        // host: "tma.local",
        // hmr: {
        //     host: 'tma.local',
        //     port: 443,
        // },
        https: {
            key: readFileSync(resolve('../.cert/tma.local+2-key.pem')),
            cert: readFileSync(resolve('../.cert/tma.local+2.pem')),
            // key: readFileSync(resolve('../.cert/local-key.pem')),
            // cert: readFileSync(resolve('../.cert/local-cert.pem')),
        },
    },
});
