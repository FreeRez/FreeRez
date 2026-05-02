import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/control-plane/schema.ts',
	out: './drizzle/control-plane',
	dialect: 'sqlite'
});
