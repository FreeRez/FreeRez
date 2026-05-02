import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			routes: {
				include: ['/*'],
				exclude: ['<all>']
			},
			platformProxy: {
				configPath: 'wrangler.toml',
				persist: { path: '.wrangler/state/v3' }
			}
		}),
		alias: {
			$db: 'src/lib/server/db',
			$api: 'src/lib/server/api'
		}
	}
};

export default config;
