export type ThemeMode = 'light' | 'dark';
export type Density = 'compact' | 'comfortable' | 'spacious';

class ThemeStore {
	mode = $state<ThemeMode>('light');
	density = $state<Density>('comfortable');
	collapsed = $state(false);

	constructor() {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('fr-theme');
			if (saved) {
				try {
					const parsed = JSON.parse(saved);
					if (parsed.mode) this.mode = parsed.mode;
					if (parsed.density) this.density = parsed.density;
					if (parsed.collapsed !== undefined) this.collapsed = parsed.collapsed;
				} catch {
					// ignore
				}
			}
			this.apply();
		}
	}

	private persist() {
		if (typeof window === 'undefined') return;
		localStorage.setItem('fr-theme', JSON.stringify({
			mode: this.mode,
			density: this.density,
			collapsed: this.collapsed,
		}));
	}

	apply() {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		root.classList.toggle('dark', this.mode === 'dark');
		root.classList.toggle('density-compact', this.density === 'compact');
		root.classList.toggle('density-spacious', this.density === 'spacious');
		root.classList.toggle('sidebar-collapsed', this.collapsed);
	}

	toggleMode() {
		this.mode = this.mode === 'dark' ? 'light' : 'dark';
		this.apply();
		this.persist();
	}

	setDensity(d: Density) {
		this.density = d;
		this.apply();
		this.persist();
	}

	toggleSidebar() {
		this.collapsed = !this.collapsed;
		this.apply();
		this.persist();
	}
}

export const theme = new ThemeStore();
