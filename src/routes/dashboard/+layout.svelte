<script lang="ts">
	import { page } from '$app/stores';
	import { theme } from '$lib/stores/theme.svelte';
	import {
		Home, Calendar, LayoutGrid, Users, Clock, Table2, Sparkles, Star, Settings,
		PanelLeft, Search, Moon, Sun, Bell, User
	} from 'lucide-svelte';

	let { children, data } = $props();
	let showNotifications = $state(false);

	const navItems = $derived([
		{ section: 'Operate' },
		{ id: 'dashboard', label: 'Today', icon: Home, href: '/dashboard', count: undefined },
		{ id: 'reservations', label: 'Reservations', icon: Calendar, href: '/dashboard/reservations', count: 16 },
		{ id: 'floor', label: 'Floor plan', icon: LayoutGrid, href: '/dashboard/floor', count: undefined },
		{ id: 'guests', label: 'Guests', icon: Users, href: '/dashboard/guests', count: undefined },
		{ section: 'Configure' },
		{ id: 'availability', label: 'Availability', icon: Clock, href: '/dashboard/availability', count: undefined },
		{ id: 'tables', label: 'Tables & areas', icon: Table2, href: '/dashboard/tables', count: undefined },
		{ id: 'experiences', label: 'Experiences', icon: Sparkles, href: '/dashboard/experiences', count: undefined },
		{ id: 'reviews', label: 'Reviews', icon: Star, href: '/dashboard/reviews', count: data.reviewCount || undefined },
		{ section: 'Account' },
		{ id: 'settings', label: 'Settings', icon: Settings, href: '/dashboard/settings', count: undefined },
	]);

	let searchInput = $state<HTMLInputElement | null>(null);
	let tooltip = $state<{ text: string; top: number; left: number } | null>(null);

	function showTooltip(e: MouseEvent, label: string) {
		if (!theme.collapsed) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		tooltip = { text: label, top: rect.top + rect.height / 2, left: rect.right + 8 };
	}

	function hideTooltip() {
		tooltip = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			searchInput?.focus();
		}
	}

	function getActiveId(pathname: string): string {
		if (pathname === '/dashboard') return 'dashboard';
		const segment = pathname.replace('/dashboard/', '').split('/')[0];
		return segment || 'dashboard';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fr-app">
	<!-- Sidebar -->
	<aside class="fr-sidebar">
		<div class="fr-sidebar-head">
			<div class="fr-logo">FR</div>
			<div class="fr-brand">
				<div class="fr-brand-name">FreeRez</div>
				<div class="fr-brand-rest">{data.restaurantName || 'Dashboard'}</div>
			</div>
		</div>
		<nav class="fr-nav">
			{#each navItems as item ('section' in item ? item.section : item.id)}
				{#if 'section' in item}
					<div class="fr-nav-section">{item.section}</div>
				{:else}
					{@const active = getActiveId($page.url.pathname) === item.id}
					{@const Icon = item.icon}
					<a
						href={item.href}
						class="fr-nav-item"
						class:active
						onmouseenter={(e) => showTooltip(e, item.label)}
						onmouseleave={hideTooltip}
					>
						<span class="fr-nav-icon">
							<Icon size={16} />
						</span>
						<span>{item.label}</span>
						<span class="fr-nav-dot"></span>
						{#if item.count != null}
							<span class="fr-nav-count">{item.count}</span>
						{/if}
					</a>
				{/if}
			{/each}
		</nav>
		<div style="padding: 0 12px; margin-bottom: 8px">
			<button class="fr-btn fr-btn-ghost fr-btn-icon" style="width: 100%; justify-content: center" onclick={() => theme.toggleSidebar()} title="Toggle sidebar">
				<PanelLeft size={16} />
			</button>
		</div>
		<div class="fr-side-foot">
			<div class="fr-avatar" style="flex-shrink: 0">{data.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}</div>
			<div class="fr-side-foot-text">
				<div class="fr-side-foot-name">{data.user.name}</div>
				<div class="fr-side-foot-org">{data.user.role ? data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1) : 'Staff'}</div>
			</div>
		</div>
	</aside>

	<!-- Main -->
	<div class="fr-main">
		<header class="fr-topbar">
			<div class="fr-search">
				<Search size={14} />
				<input bind:this={searchInput} placeholder="Search guests, reservations, tables…" />
				<kbd>⌘K</kbd>
			</div>
			<div class="fr-topbar-spacer"></div>
			<button class="fr-btn fr-btn-ghost fr-btn-icon" onclick={() => theme.toggleMode()} title="Toggle theme">
				{#if theme.mode === 'dark'}
					<Sun size={16} />
				{:else}
					<Moon size={16} />
				{/if}
			</button>
			<div style="position: relative">
				<button class="fr-btn fr-btn-ghost fr-btn-icon" title="Notifications" onclick={() => showNotifications = !showNotifications}>
					<Bell size={16} />
				</button>
				{#if showNotifications}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div style="position: fixed; inset: 0; z-index: 50" onclick={() => showNotifications = false}></div>
					<div style="position: absolute; top: 42px; right: 0; width: 360px; background: var(--fr-surface); border: 1px solid var(--fr-border); border-radius: var(--fr-radius); box-shadow: var(--fr-shadow-lg); z-index: 51; overflow: hidden">
						<div style="padding: 14px 16px; border-bottom: 1px solid var(--fr-border); font-weight: 600; font-size: 14px">Notifications</div>
						<div style="padding: 12px 16px; font-size: 13px; color: var(--fr-text-muted)">No new notifications</div>
					</div>
				{/if}
			</div>
			<a href="/login" class="fr-btn fr-btn-ghost fr-btn-icon" title="Sign out">
				<User size={16} />
			</a>
		</header>

		{@render children()}
	</div>
</div>

{#if tooltip}
	<div class="fr-sidebar-tooltip visible" style="top: {tooltip.top}px; left: {tooltip.left}px; transform: translateY(-50%)">
		{tooltip.text}
	</div>
{/if}
