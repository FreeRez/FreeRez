<script lang="ts">
	import { Plus, Check, Users, LayoutGrid, Tag, Zap, X, Trash2, MousePointer, PenTool, DoorOpen, Briefcase, Square, Layers, ChevronDown, Save } from 'lucide-svelte';
	import type { NormalizedTable, NormalizedReservation, NormalizedSection } from '$lib/server/dashboard/normalize';
	import ReservationDrawer from '$lib/components/dashboard/ReservationDrawer.svelte';
	import {
		floorPlanData,
		type FloorTable,
		type Floor,
		type Wall,
		type Door,
		type Fixture,
		type FloorArea,
		type Point,
		type TableStatus,
		type AreaTint
	} from '$lib/stores/floorplan-data';

	let { data } = $props();

	// ─── Scale ───────────────────────────────────────────────────────────────
	const PX_PER_CM = 1;
	const GRID_CM = 50;
	const GRID_MINOR_CM = 10;
	const SNAP_CM = 5;
	const SNAP_ENDPOINT_CM = 25;
	const SNAP_ANGLE_DEG = 5;

	// ─── Unit formatting ─────────────────────────────────────────────────────
	function fmtLen(cm: number, system: string): string {
		if (system === 'imperial') {
			const inches = cm / 2.54;
			if (inches < 12) return `${Math.round(inches)}″`;
			const ft = Math.floor(inches / 12);
			const ins = Math.round(inches - ft * 12);
			return ins ? `${ft}′${ins}″` : `${ft}′`;
		}
		return `${(cm / 100).toFixed(2)}m`;
	}

	// ─── Geometry helpers ────────────────────────────────────────────────────
	function dist(a: Point, b: Point): number {
		return Math.hypot(a.x - b.x, a.y - b.y);
	}
	function snapToGrid(v: number, step = SNAP_CM): number {
		return Math.round(v / step) * step;
	}
	function snapAngle(deg: number): number {
		const targets = [0, 45, 90, 135, 180, -45, -90, -135, -180];
		let best = deg;
		let bestDiff = Infinity;
		for (const t of targets) {
			const d = Math.abs(((deg - t + 180) % 360 + 360) % 360 - 180);
			if (d < bestDiff && d <= SNAP_ANGLE_DEG) {
				best = t;
				bestDiff = d;
			}
		}
		return best;
	}
	function snapVecAngle(originX: number, originY: number, x: number, y: number): Point {
		const dx = x - originX;
		const dy = y - originY;
		const len = Math.hypot(dx, dy);
		if (len < 1) return { x, y };
		const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
		const snapped = snapAngle(deg);
		if (snapped === deg) return { x, y };
		const r = (snapped * Math.PI) / 180;
		return { x: originX + Math.cos(r) * len, y: originY + Math.sin(r) * len };
	}

	interface SeatInfo { x: number; y: number; angle: number }

	function computeSeats(t: FloorTable): SeatInfo[] {
		const seats: { lx: number; ly: number; a: number }[] = [];
		const N = t.seats;
		if (t.shape === 'round') {
			const radius = (t.d ?? 80) / 2 + 2;
			for (let i = 0; i < N; i++) {
				const a = (i / N) * Math.PI * 2 - Math.PI / 2;
				seats.push({ lx: Math.cos(a) * radius, ly: Math.sin(a) * radius, a: a + Math.PI / 2 });
			}
		} else {
			const w = t.w ?? 100;
			const h = t.h ?? 80;
			const widthwise = w >= h;
			let top: number, bot: number, left: number, right: number;
			if (N <= 2) { top = 1; bot = 1; left = 0; right = 0; }
			else if (N <= 6) { top = Math.ceil(N / 2); bot = Math.floor(N / 2); left = 0; right = 0; }
			else { top = Math.ceil((N - 2) / 2); bot = Math.floor((N - 2) / 2); left = 1; right = 1; }
			if (!widthwise) {
				[top, left] = [left, top];
				[bot, right] = [right, bot];
			}
			const place = (n: number, x0: number, y0: number, ddx: number, ddy: number, len: number, angle: number) => {
				for (let i = 0; i < n; i++) {
					const f = (i + 1) / (n + 1);
					seats.push({ lx: x0 + ddx * f * len, ly: y0 + ddy * f * len, a: angle });
				}
			};
			const gap = 2;
			place(top, -w / 2, -h / 2 - gap, 1, 0, w, 0);
			place(bot, -w / 2, h / 2 + gap, 1, 0, w, Math.PI);
			place(left, -w / 2 - gap, -h / 2, 0, 1, h, -Math.PI / 2);
			place(right, w / 2 + gap, -h / 2, 0, 1, h, Math.PI / 2);
		}
		const rad = ((t.rot || 0) * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		return seats.map((s) => ({
			x: t.x + s.lx * cos - s.ly * sin,
			y: t.y + s.lx * sin + s.ly * cos,
			angle: (s.a + rad) * 180 / Math.PI,
		}));
	}

	function tableBounds(t: FloorTable): { cx?: number; cy?: number; r?: number; minX?: number; maxX?: number; minY?: number; maxY?: number } {
		const margin = 8;
		if (t.shape === 'round') return { cx: t.x, cy: t.y, r: (t.d ?? 80) / 2 + margin };
		const w = (t.w ?? 100) + margin * 2;
		const h = (t.h ?? 80) + margin * 2;
		const rad = ((t.rot || 0) * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		const corners = [
			{ x: -w / 2, y: -h / 2 },
			{ x: w / 2, y: -h / 2 },
			{ x: w / 2, y: h / 2 },
			{ x: -w / 2, y: h / 2 }
		].map((p) => ({ x: t.x + p.x * cos - p.y * sin, y: t.y + p.x * sin + p.y * cos }));
		const xs = corners.map((c) => c.x);
		const ys = corners.map((c) => c.y);
		return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
	}

	function boundsOverlap(
		a: { cx?: number; cy?: number; r?: number; minX?: number; maxX?: number; minY?: number; maxY?: number },
		b: { cx?: number; cy?: number; r?: number; minX?: number; maxX?: number; minY?: number; maxY?: number }
	): boolean {
		if (a.r != null && b.r != null)
			return dist({ x: a.cx!, y: a.cy! }, { x: b.cx!, y: b.cy! }) < a.r + b.r;
		let aa = a;
		let bb = b;
		if (aa.r != null) {
			[aa, bb] = [bb, aa];
		}
		if (bb.r != null) {
			const cx = Math.max(aa.minX!, Math.min(bb.cx!, aa.maxX!));
			const cy = Math.max(aa.minY!, Math.min(bb.cy!, aa.maxY!));
			return Math.hypot(bb.cx! - cx, bb.cy! - cy) < bb.r;
		}
		return !(aa.maxX! < bb.minX! || bb.maxX! < aa.minX! || aa.maxY! < bb.minY! || bb.maxY! < aa.minY!);
	}

	function pointSegDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
		const dx = x2 - x1;
		const dy = y2 - y1;
		const len2 = dx * dx + dy * dy;
		if (len2 === 0) return Math.hypot(px - x1, py - y1);
		const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
		return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
	}

	function closestOnSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): { x: number; y: number; t: number } {
		const dx = x2 - x1;
		const dy = y2 - y1;
		const len2 = dx * dx + dy * dy;
		if (len2 === 0) return { x: x1, y: y1, t: 0 };
		const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
		return { x: x1 + t * dx, y: y1 + t * dy, t };
	}

	function tableHitsWalls(t: FloorTable, wallList: Wall[]): boolean {
		const r = t.shape === 'round' ? (t.d ?? 80) / 2 + 4 : Math.max(t.w ?? 100, t.h ?? 80) / 2 + 4;
		for (const w of wallList) {
			for (let i = 0; i < w.points.length - 1; i++) {
				if (pointSegDist(t.x, t.y, w.points[i].x, w.points[i].y, w.points[i + 1].x, w.points[i + 1].y) < r)
					return true;
			}
			if (w.closed && w.points.length > 2) {
				const a = w.points[w.points.length - 1];
				const b = w.points[0];
				if (pointSegDist(t.x, t.y, a.x, a.y, b.x, b.y) < r) return true;
			}
		}
		return false;
	}

	function resolveDoorPos(door: Door, wallList: Wall[]): { x: number; y: number; angleDeg: number; segLen?: number; anchorDist?: number } {
		if (door.wallId == null)
			return { x: door.x || 0, y: door.y || 0, angleDeg: door.wallAngle || 0 };
		const wall = wallList.find((w) => w.id === door.wallId);
		if (!wall) return { x: door.x || 0, y: door.y || 0, angleDeg: door.wallAngle || 0 };
		const seg = Math.min(door.segIndex || 0, wall.points.length - 2);
		const a = wall.points[seg];
		const b = wall.points[seg + 1];
		if (!b) return { x: a.x, y: a.y, angleDeg: 0 };
		const t = Math.max(0, Math.min(1, door.t ?? 0.5));
		const len = dist(a, b);
		const x = a.x + (b.x - a.x) * t;
		const y = a.y + (b.y - a.y) * t;
		const angleDeg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
		return { x, y, angleDeg, segLen: len, anchorDist: t * len };
	}

	function tableHitsDoorSwing(t: FloorTable, door: Door, wallList: Wall[]): boolean {
		const pos = resolveDoorPos(door, wallList);
		const r = t.shape === 'round' ? (t.d ?? 80) / 2 : Math.max(t.w ?? 100, t.h ?? 80) / 2;
		return Math.hypot(t.x - pos.x, t.y - pos.y) < door.width - 4 + r * 0.4;
	}

	function detectCollisions(tableList: FloorTable[], wallList: Wall[], doorList: Door[]): Set<string> {
		const bad = new Set<string>();
		const bb = tableList.map((t) => ({
			id: t.id,
			b: tableBounds(t),
			wall: tableHitsWalls(t, wallList),
			door: doorList.some((d) => tableHitsDoorSwing(t, d, wallList))
		}));
		for (const it of bb) if (it.wall || it.door) bad.add(it.id);
		for (let i = 0; i < bb.length; i++)
			for (let j = i + 1; j < bb.length; j++)
				if (boundsOverlap(bb[i].b, bb[j].b)) {
					bad.add(bb[i].id);
					bad.add(bb[j].id);
				}
		return bad;
	}

	const STATUS_THEME: Record<TableStatus, { fill: string; stroke: string; accent: string }> = {
		available: {
			fill: 'color-mix(in oklch, var(--fr-success) 10%, var(--fr-surface))',
			stroke: 'color-mix(in oklch, var(--fr-success) 55%, var(--fr-border))',
			accent: 'var(--fr-success)'
		},
		reserved: {
			fill: 'color-mix(in oklch, var(--fr-info) 10%, var(--fr-surface))',
			stroke: 'color-mix(in oklch, var(--fr-info) 55%, var(--fr-border))',
			accent: 'var(--fr-info)'
		},
		seated: {
			fill: 'color-mix(in oklch, var(--fr-success) 22%, var(--fr-surface))',
			stroke: 'var(--fr-success)',
			accent: 'var(--fr-success)'
		},
		dirty: {
			fill: 'color-mix(in oklch, var(--fr-warn) 16%, var(--fr-surface))',
			stroke: 'color-mix(in oklch, var(--fr-warn) 65%, var(--fr-border))',
			accent: 'var(--fr-warn)'
		},
		blocked: {
			fill: 'var(--fr-surface-muted)',
			stroke: 'var(--fr-border-strong)',
			accent: 'var(--fr-text-subtle)'
		},
		'no-show': {
			fill: 'color-mix(in oklch, var(--fr-danger) 12%, var(--fr-surface))',
			stroke: 'color-mix(in oklch, var(--fr-danger) 65%, var(--fr-border))',
			accent: 'var(--fr-danger)'
		}
	};

	const AREA_TINT: Record<string, { bg: string; overlay: string | null }> = {
		main: { bg: 'url(#fp-floor)', overlay: null },
		bar: { bg: 'var(--fr-surface)', overlay: null },
		garden: { bg: 'url(#fp-garden)', overlay: 'color-mix(in oklch, var(--fr-success) 6%, transparent)' },
		priv: { bg: 'color-mix(in oklch, var(--fr-accent) 4%, var(--fr-surface))', overlay: null }
	};

	// ─── Migrate seed doors to wall-attached form ────────────────────────────
	function migrateDoors(rawDoors: Door[], wallList: Wall[]): Door[] {
		return rawDoors.map((d) => {
			if (d.wallId) return d;
			let best = { d: Infinity, wallId: '', segIndex: 0, t: 0 };
			for (const w of wallList) {
				for (let i = 0; i < w.points.length - 1; i++) {
					const a = w.points[i];
					const b = w.points[i + 1];
					const c = closestOnSeg(d.x, d.y, a.x, a.y, b.x, b.y);
					const dd = Math.hypot(d.x - c.x, d.y - c.y);
					if (dd < best.d) best = { d: dd, wallId: w.id, segIndex: i, t: c.t };
				}
			}
			return { ...d, wallId: best.wallId, segIndex: best.segIndex, t: best.t };
		});
	}

	// ─── State ────────────────────────────────────────────────────────────────
	const staticFp = floorPlanData;

	// Load floors from saved layout (SpaceEditor), falling back to static defaults
	function loadFloors(): Floor[] {
		const savedFloors = data.savedLayout?.floors as Floor[] | undefined;
		if (savedFloors && savedFloors.length > 0) return savedFloors;
		return staticFp.floors;
	}

	const floors = loadFloors();
	let activeFloorId = $state(floors[0].id);
	const activeFloor = $derived(floors.find(f => f.id === activeFloorId) ?? floors[0]);

	function dbShapeToFloor(s: string): 'round' | 'rect' {
		if (s === 'round') return 'round';
		return 'rect';
	}

	// Load tables: DB tables are the source of truth, geometry merged from savedLayout
	function loadTables(): FloorTable[] {
		const saved = data.savedLayout?.tables as FloorTable[] | undefined;
		const savedMap = new Map((saved ?? []).map(t => [t.id, t]));
		const dbTables: NormalizedTable[] = data.tables ?? [];

		// If DB has tables, use them as source of truth
		if (dbTables.length > 0) {
			const result: FloorTable[] = [];
			const seen = new Set<string>();

			for (const dbt of dbTables) {
				const geo = savedMap.get(dbt.id);
				result.push({
					id: dbt.id,
					area: dbt.area,
					floorId: geo?.floorId ?? 'floor-1',
					shape: geo?.shape ?? dbShapeToFloor(dbt.shape),
					x: geo?.x ?? dbt.x,
					y: geo?.y ?? dbt.y,
					d: geo?.d ?? (dbt.shape === 'round' ? 80 : undefined),
					w: geo?.w ?? (dbt.shape !== 'round' ? 100 : undefined),
					h: geo?.h ?? (dbt.shape !== 'round' ? 70 : undefined),
					rot: geo?.rot ?? 0,
					seats: dbt.seats,
					status: (dbt.status as TableStatus) ?? 'available',
				});
				seen.add(dbt.id);
			}

			// Include any saved-only tables not in DB (user-created in editor, not yet synced)
			for (const s of (saved ?? [])) {
				if (!seen.has(s.id)) {
					result.push({ ...s, floorId: s.floorId ?? 'floor-1', rot: s.rot ?? 0 });
				}
			}

			return result;
		}

		// Fallback: no DB tables yet, use saved layout or static demo data
		if (saved && saved.length > 0) {
			return saved.map(t => ({ ...t, floorId: t.floorId ?? 'floor-1', rot: t.rot ?? 0 }));
		}
		return staticFp.tables.map(t => ({ ...t, floorId: t.floorId ?? 'floor-1', rot: t.rot ?? 0 }));
	}

	let tables = $state<FloorTable[]>(loadTables());
	let walls = $state<Wall[]>([...floors[0].walls]);
	let doors = $state<Door[]>(migrateDoors(floors[0].doors || [], floors[0].walls));
	let fixtures = $state<Fixture[]>([...floors[0].fixtures]);
	let areas = $state<FloorArea[]>([...(floors[0].areas || [])]);

	// Update architectural elements when floor changes
	$effect(() => {
		const floor = activeFloor;
		walls = [...floor.walls];
		doors = migrateDoors(floor.doors || [], floor.walls);
		fixtures = [...floor.fixtures];
		areas = [...(floor.areas || [])];
	});

	// ─── Undo / Redo ─────────────────────────────────────────────────────────
	type Snapshot = {
		tables: FloorTable[];
		walls: Wall[];
		doors: Door[];
		fixtures: Fixture[];
		areas: FloorArea[];
	};

	const MAX_UNDO = 50;
	let undoStack: Snapshot[] = [];
	let redoStack: Snapshot[] = [];

	function takeSnapshot(): Snapshot {
		return JSON.parse(JSON.stringify({
			tables: $state.snapshot(tables),
			walls: $state.snapshot(walls),
			doors: $state.snapshot(doors),
			fixtures: $state.snapshot(fixtures),
			areas: $state.snapshot(areas),
		}));
	}

	function pushUndo() {
		undoStack.push(takeSnapshot());
		if (undoStack.length > MAX_UNDO) undoStack.shift();
		redoStack = [];
	}

	function undo() {
		if (undoStack.length === 0) return;
		redoStack.push(takeSnapshot());
		const snap = undoStack.pop()!;
		tables = snap.tables;
		walls = snap.walls;
		doors = snap.doors;
		fixtures = snap.fixtures;
		areas = snap.areas;
	}

	function redo() {
		if (redoStack.length === 0) return;
		undoStack.push(takeSnapshot());
		const snap = redoStack.pop()!;
		tables = snap.tables;
		walls = snap.walls;
		doors = snap.doors;
		fixtures = snap.fixtures;
		areas = snap.areas;
	}

	let units = $state<'metric' | 'imperial'>('metric');
	let area = $state('All');
	let mode = $state<'service' | 'edit'>('service');
	let tool = $state<'select'>('select');
	let drawing = $state<{ kind: string; points?: Point[]; x1?: number; y1?: number; x2?: number; y2?: number } | null>(null);
	let mouseWorld = $state<Point | null>(null);
	let selected = $state<{ kind: string; id: string } | null>(null);
	let hover = $state<string | null>(null);
	let showSeats = $state(true);
	let showGrid = $state(true);
	let showDims = $state(true);
	let spaceHeld = $state(false);
	let showCollisions = $state(true);
	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let svgRef = $state<SVGSVGElement | null>(null);
	let svgClientW = $state(800);
	let openRes = $state<NormalizedReservation | null>(null);
	let serviceTableId = $state<string | null>(null);
	let editingSections = $state(false);
	let editSectionId = $state<string | null>(null);
	let newSectionName = $state('');
	let newSectionStaffId = $state('');
	let newSectionColor = $state('#4A90D9');
	let newSectionTableIds = $state<string[]>([]);
	const SECTION_COLORS = ['#4A90D9', '#D94A4A', '#4AD97A', '#D9A64A', '#9B4AD9', '#4AD9D9', '#D94A9B', '#7AD94A'];
	let showLayoutMenu = $state(false);
	let layoutMenuPos = $state({ x: 0, y: 0 });
	let showSaveAsDialog = $state(false);
	let saveAsName = $state('');
	const activeLayoutName = $derived((data.layouts ?? []).find((l: { id: string }) => l.id === data.activeLayoutId)?.name ?? 'Default');

	let dragRef = $state<{
		kind: string;
		target?: string;
		id?: string;
		dx?: number;
		dy?: number;
		startAngle?: number;
		startRot?: number;
		wallId?: string;
		idx?: number;
		sx?: number;
		sy?: number;
		originalPoints?: Point[];
		startClientX?: number;
		startClientY?: number;
		startPanX?: number;
		startPanY?: number;
	} | null>(null);

	const floorTables = $derived(tables.filter((t) => t.floorId === activeFloorId));
	const visibleTables = $derived(floorTables.filter((t) => area === 'All' || t.area === area));

	const tableSectionMap = $derived(() => {
		const map = new Map<string, NormalizedSection>();
		for (const section of (data.sections ?? [])) {
			for (const tid of section.tableIds) {
				map.set(tid, section);
			}
		}
		return map;
	});

	let showSections = $state(true);

	const tablesAug = $derived(
		visibleTables.map((t) => {
			const res = data.reservations.find(
				(r: NormalizedReservation) =>
					r.table.includes(t.id) && (r.status === 'seated' || r.status === 'confirmed')
			);
			const section = tableSectionMap().get(t.id) ?? null;
			return { ...t, res: res as NormalizedReservation | undefined, section };
		})
	);
	const serviceTable = $derived(serviceTableId ? tablesAug.find(t => t.id === serviceTableId) ?? null : null);

	const collisions = $derived.by(() =>
		mode === 'edit' && showCollisions ? detectCollisions(tables, walls, doors) : new Set<string>()
	);

	const counts = $derived({
		seated: tables.filter((t) => t.status === 'seated').length,
		reserved: tables.filter((t) => t.status === 'reserved').length,
		available: tables.filter((t) => t.status === 'available').length,
		dirty: tables.filter((t) => t.status === 'dirty').length,
		blocked: tables.filter((t) => t.status === 'blocked').length,
		'no-show': tables.filter((t) => t.status === 'no-show').length
	});

	const totalSeats = $derived(tables.reduce((s, t) => s + t.seats, 0));
	const occupiedSeats = $derived(
		tables
			.filter((t) => t.status === 'seated' || t.status === 'reserved')
			.reduce((s, t) => s + t.seats, 0)
	);

	const SIDEBAR_REM = 20;
	const W = $derived(activeFloor.world.w);
	const H = $derived(activeFloor.world.h);
	const vbW = $derived(W / zoom);
	const vbH = $derived(H / zoom);
	const vbX = $derived(panX);
	const vbY = $derived(panY);

	const pxPerUnit = $derived(svgClientW > 0 && vbW > 0 ? svgClientW / vbW : 1);
	const SCALE_STEPS = [50, 100, 200, 500, 1000, 2000, 5000];
	const scaleCm = $derived(SCALE_STEPS.find(s => s * pxPerUnit >= 60) ?? 1000);
	const scaleBarPx = $derived(scaleCm * pxPerUnit);

	let animFrame = 0;

	function animateTo(targetZoom: number, targetPanX: number, targetPanY: number) {
		cancelAnimationFrame(animFrame);
		const startZoom = zoom, startPanX = panX, startPanY = panY;
		const duration = 350;
		const start = performance.now();
		function tick(now: number) {
			const t = Math.min((now - start) / duration, 1);
			const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
			zoom = startZoom + (targetZoom - startZoom) * ease;
			panX = startPanX + (targetPanX - startPanX) * ease;
			panY = startPanY + (targetPanY - startPanY) * ease;
			if (t < 1) animFrame = requestAnimationFrame(tick);
		}
		animFrame = requestAnimationFrame(tick);
	}

	function fitToContent(targetTables?: FloorTable[], animate = true, includeWalls = false) {
		const svg = svgRef;
		if (!svg) return;
		const cw = svg.clientWidth;
		const ch = svg.clientHeight;
		if (cw <= 0 || ch <= 0) return;

		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
		const sidebarPx = SIDEBAR_REM * rem + 24;
		const toolbarPx = 60;
		const marginPx = 30;

		const items = targetTables ?? tables;
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

		for (const t of items) {
			const cm = 14;
			const hw = t.shape === 'round' ? (t.d ?? 80) / 2 + cm : (t.w ?? 100) / 2 + cm;
			const hh = t.shape === 'round' ? (t.d ?? 80) / 2 + cm : (t.h ?? 80) / 2 + cm;
			minX = Math.min(minX, t.x - hw); minY = Math.min(minY, t.y - hh);
			maxX = Math.max(maxX, t.x + hw); maxY = Math.max(maxY, t.y + hh);
		}

		if (includeWalls || !targetTables) {
			for (const w of walls) {
				for (const p of w.points) {
					minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
					maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
				}
			}
		}

		if (minX === Infinity) {
			minX = 0; minY = 0; maxX = W; maxY = H;
		}

		const contentW = maxX - minX;
		const contentH = maxY - minY;
		const contentCx = (minX + maxX) / 2;
		const contentCy = (minY + maxY) / 2;

		const usableWPx = cw - sidebarPx - marginPx * 2;
		const usableHPx = ch - toolbarPx - marginPx * 2;
		if (usableWPx <= 0 || usableHPx <= 0) return;

		const zoomW = (usableWPx / cw) * (W / contentW);
		const zoomH = (usableHPx / ch) * (H / contentH);
		const targetZoom = Math.round(Math.min(zoomW, zoomH, 2) * 100) / 100;

		const vbW2 = W / targetZoom;
		const vbH2 = H / targetZoom;
		const centerPxX = marginPx + usableWPx / 2;
		const centerPxY = toolbarPx + marginPx + usableHPx / 2;
		const targetPanX = contentCx - (centerPxX / cw) * vbW2;
		const targetPanY = contentCy - (centerPxY / ch) * vbH2;

		if (animate) {
			animateTo(targetZoom, targetPanX, targetPanY);
		} else {
			zoom = targetZoom;
			panX = targetPanX;
			panY = targetPanY;
		}
	}

	let didInitialFit = false;
	$effect(() => {
		const svg = svgRef;
		if (!svg) return;
		svgClientW = svg.clientWidth;
		if (didInitialFit) return;
		didInitialFit = true;
		fitToContent(undefined, false);
	});

	$effect(() => {
		const svg = svgRef;
		if (!svg) return;
		const ro = new ResizeObserver(() => { svgClientW = svg.clientWidth; });
		ro.observe(svg);
		return () => ro.disconnect();
	});

	// ─── Coordinate helpers ──────────────────────────────────────────────────
	function toWorld(clientX: number, clientY: number, snap = true): Point {
		const svg = svgRef;
		if (!svg) return { x: 0, y: 0 };
		const pt = svg.createSVGPoint();
		pt.x = clientX;
		pt.y = clientY;
		const ctm = svg.getScreenCTM();
		if (!ctm) return { x: 0, y: 0 };
		const w = pt.matrixTransform(ctm.inverse());
		if (!snap) return { x: w.x, y: w.y };
		return { x: snapToGrid(w.x), y: snapToGrid(w.y) };
	}

	function snapToEndpoints(p: Point): Point & { snapped?: string } {
		let best: Point | null = null;
		let bestD = SNAP_ENDPOINT_CM;
		for (const w of walls) {
			for (const pt of w.points) {
				const d = Math.hypot(p.x - pt.x, p.y - pt.y);
				if (d < bestD) {
					best = pt;
					bestD = d;
				}
			}
		}
		return best ? { ...best, snapped: 'endpoint' } : p;
	}

	const SNAP_JOIN = 2;

	function propagateVertexMoves(ws: Wall[], moves: { from: Point; to: Point }[], excludeWallId?: string): Wall[] {
		if (moves.length === 0) return ws;
		return ws.map(w => {
			if (w.id === excludeWallId) return w;
			let changed = false;
			const pts = w.points.map(p => {
				for (const m of moves) {
					if (Math.abs(p.x - m.from.x) <= SNAP_JOIN && Math.abs(p.y - m.from.y) <= SNAP_JOIN) {
						changed = true;
						return { x: m.to.x, y: m.to.y };
					}
				}
				return p;
			});
			return changed ? { ...w, points: pts } : w;
		});
	}

	// ─── Selection + update helpers ──────────────────────────────────────────
	function isSel(kind: string, id: string): boolean {
		return selected != null && selected.kind === kind && selected.id === id;
	}
	function select(kind: string, id: string) {
		selected = { kind, id };
	}
	function updateTable(id: string, patch: Partial<FloorTable>) {
		tables = tables.map((t) => (t.id === id ? { ...t, ...patch } : t));
	}
	function updateWall(id: string, patch: Partial<Wall>) {
		walls = walls.map((w) => (w.id === id ? { ...w, ...patch } : w));
	}
	function updateWallPoint(id: string, idx: number, patch: Partial<Point>) {
		walls = walls.map((w) => {
			if (w.id !== id) return w;
			const points = w.points.map((p, i) => (i === idx ? { ...p, ...patch } : p));
			return { ...w, points };
		});
	}
	function updateDoor(id: string, patch: Partial<Door>) {
		doors = doors.map((d) => (d.id === id ? { ...d, ...patch } : d));
	}
	function updateFixture(id: string, patch: Partial<Fixture>) {
		fixtures = fixtures.map((f) => (f.id === id ? { ...f, ...patch } : f));
	}
	function updateArea(id: string, patch: Partial<FloorArea>) {
		areas = areas.map((a) => (a.id === id ? { ...a, ...patch } : a));
	}

	function deleteSelected() {
		if (!selected) return;
		pushUndo();
		const { kind, id } = selected;
		if (kind === 'table') tables = tables.filter((t) => t.id !== id);
		if (kind === 'wall') {
			walls = walls.filter((w) => w.id !== id);
			doors = doors.filter((d) => d.wallId !== id);
		}
		if (kind === 'door') doors = doors.filter((d) => d.id !== id);
		if (kind === 'fixture') fixtures = fixtures.filter((f) => f.id !== id);
		if (kind === 'area') areas = areas.filter((a) => a.id !== id);
		if (kind === 'vertex') {
			const [wallId, idxStr] = id.split('::');
			walls = walls.map((w) => {
				if (w.id !== wallId) return w;
				if (w.points.length <= 2) return w;
				return { ...w, points: w.points.filter((_, i) => i !== +idxStr) };
			});
		}
		if (kind === 'segment') {
			const [wallId, idxStr] = id.split('::');
			const segIdx = +idxStr;
			const wall = walls.find(w => w.id === wallId);
			if (wall) {
				if (wall.points.length <= 3) {
					walls = walls.filter(w => w.id !== wallId);
					doors = doors.filter(d => d.wallId !== wallId);
				} else {
					const idxB = (segIdx + 1) % wall.points.length;
					const removeIdx = wall.closed ? idxB : Math.max(segIdx, idxB);
					walls = walls.map(w => {
						if (w.id !== wallId) return w;
						return { ...w, points: w.points.filter((_, i) => i !== removeIdx) };
					});
				}
			}
		}
		selected = null;
	}

	function findNearestWallPoint(p: Point): { wallId: string; segIndex: number; t: number; x: number; y: number } | null {
		let best: { wallId: string; segIndex: number; t: number; x: number; y: number; d: number } | null = null;
		for (const w of walls) {
			for (let i = 0; i < w.points.length - 1; i++) {
				const a = w.points[i];
				const b = w.points[i + 1];
				const c = closestOnSeg(p.x, p.y, a.x, a.y, b.x, b.y);
				const d = Math.hypot(p.x - c.x, p.y - c.y);
				if (d < 60 && (!best || d < best.d)) {
					best = { wallId: w.id, segIndex: i, t: c.t, x: c.x, y: c.y, d };
				}
			}
		}
		return best;
	}

	// ─── Door geometry for rendering ─────────────────────────────────────────
	function getDoorGeometry(d: Door) {
		const pos = resolveDoorPos(d, walls);
		const wallRad = (pos.angleDeg * Math.PI) / 180;
		const dirX = Math.cos(wallRad);
		const dirY = Math.sin(wallRad);
		const hingeSign = d.hinge === 'left' ? 1 : -1;
		const openSign = d.swing === 'in' ? 1 : -1;
		const openRad = openSign * hingeSign * (d.open * Math.PI) / 180;
		const totalRad = wallRad + openRad;
		const panelEndX = pos.x + Math.cos(totalRad) * d.width * hingeSign;
		const panelEndY = pos.y + Math.sin(totalRad) * d.width * hingeSign;
		const closedEndX = pos.x + dirX * d.width * hingeSign;
		const closedEndY = pos.y + dirY * d.width * hingeSign;
		return { pos, openRad, panelEndX, panelEndY, closedEndX, closedEndY, dirY, hingeSign };
	}

	// ─── Canvas mouse handlers ───────────────────────────────────────────────
	function onCanvasMouseDown(e: MouseEvent) {
		cancelAnimationFrame(animFrame);
		if (spaceHeld) {
			e.preventDefault();
			dragRef = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, startPanX: panX, startPanY: panY };
			return;
		}
		if (mode === 'edit') {
			selected = null;
		} else {
			serviceTableId = null;
		}

		// Pan: click and hold on empty canvas to drag the view
		e.preventDefault();
		dragRef = {
			kind: 'pan',
			startClientX: e.clientX,
			startClientY: e.clientY,
			startPanX: panX,
			startPanY: panY
		};
	}

	function onCanvasMouseMove(e: MouseEvent) {
		if (mode === 'edit') {
			const w = toWorld(e.clientX, e.clientY, false);
			mouseWorld = w;
		}
	}

	function onItemMouseDown(e: MouseEvent, kind: string, id: string) {
		if (spaceHeld) {
			e.stopPropagation(); e.preventDefault();
			dragRef = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, startPanX: panX, startPanY: panY };
			return;
		}
		if (mode !== 'edit') {
			if (kind === 'table') {
				e.stopPropagation();
				if (editingSections && editSectionId) {
					if (newSectionTableIds.includes(id)) {
						newSectionTableIds = newSectionTableIds.filter(t => t !== id);
					} else {
						newSectionTableIds = [...newSectionTableIds, id];
					}
				} else {
					serviceTableId = id;
				}
			}
			return;
		}
		if (tool !== 'select') return;
		e.stopPropagation();
		e.preventDefault();
		pushUndo();
		select(kind, id);
		const start = toWorld(e.clientX, e.clientY);

		if (kind === 'table') {
			const item = tables.find((t) => t.id === id);
			if (item) dragRef = { kind: 'move', target: kind, id, dx: item.x - start.x, dy: item.y - start.y };
		} else if (kind === 'fixture') {
			const item = fixtures.find((f) => f.id === id);
			if (item) dragRef = { kind: 'move', target: kind, id, dx: item.x - start.x, dy: item.y - start.y };
		} else if (kind === 'area') {
			const item = areas.find((a) => a.id === id);
			if (item) dragRef = { kind: 'move', target: kind, id, dx: item.x - start.x, dy: item.y - start.y };
		} else if (kind === 'door') {
			dragRef = { kind: 'slide-door', id };
		} else if (kind === 'wall') {
			const wall = walls.find((w) => w.id === id);
			if (!wall) return;
			const segCount = wall.closed ? wall.points.length : wall.points.length - 1;
			let bestSeg = 0, bestDist = Infinity;
			for (let i = 0; i < segCount; i++) {
				const a = wall.points[i], b = wall.points[(i + 1) % wall.points.length];
				const c = closestOnSeg(start.x, start.y, a.x, a.y, b.x, b.y);
				const dd = Math.hypot(start.x - c.x, start.y - c.y);
				if (dd < bestDist) { bestDist = dd; bestSeg = i; }
			}
			selected = { kind: 'segment', id: `${id}::${bestSeg}` };
			const origA = { ...wall.points[bestSeg] };
			const origB = { ...wall.points[(bestSeg + 1) % wall.points.length] };
			dragRef = { kind: 'move-seg', wallId: id, idx: bestSeg, sx: start.x, sy: start.y, originalPoints: [origA, origB] };
		}
	}

	function onVertexMouseDown(e: MouseEvent, wallId: string, idx: number) {
		e.stopPropagation(); e.preventDefault();
		if (spaceHeld) { dragRef = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, startPanX: panX, startPanY: panY }; return; }
		pushUndo();
		select('vertex', `${wallId}::${idx}`);
		dragRef = { kind: 'drag-vertex', wallId, idx };
	}

	function onMidpointMouseDown(e: MouseEvent, wallId: string, idx: number) {
		e.stopPropagation();
		e.preventDefault();
		pushUndo();
		const wall = walls.find((w) => w.id === wallId);
		if (!wall) return;
		const a = wall.points[idx];
		const b = wall.points[idx + 1];
		const mid = { x: snapToGrid((a.x + b.x) / 2), y: snapToGrid((a.y + b.y) / 2) };
		walls = walls.map((w) => {
			if (w.id !== wallId) return w;
			const points = [...w.points];
			points.splice(idx + 1, 0, mid);
			return { ...w, points };
		});
		select('vertex', `${wallId}::${idx + 1}`);
		dragRef = { kind: 'drag-vertex', wallId, idx: idx + 1 };
	}

	function onRotateMouseDown(e: MouseEvent, t: FloorTable) {
		e.stopPropagation();
		e.preventDefault();
		pushUndo();
		select('table', t.id);
		const start = toWorld(e.clientX, e.clientY, false);
		const startAngle = (Math.atan2(start.y - t.y, start.x - t.x) * 180) / Math.PI;
		dragRef = { kind: 'rotate', target: 'table', id: t.id, startAngle, startRot: t.rot || 0 };
	}

	// ─── Global mouse move/up for drag operations ────────────────────────────
	$effect(() => {
		const onMove = (e: MouseEvent) => {
			if (!dragRef && !drawing) return;
			const dr = dragRef;

			if (dr?.kind === 'pan') {
				const svg = svgRef;
				if (!svg) return;
				const scale = vbW / svg.clientWidth;
				panX = (dr.startPanX ?? 0) - (e.clientX - (dr.startClientX ?? 0)) * scale;
				panY = (dr.startPanY ?? 0) - (e.clientY - (dr.startClientY ?? 0)) * scale;
				return;
			}

			const wRaw = toWorld(e.clientX, e.clientY, false);
			const w = toWorld(e.clientX, e.clientY);

			if (dr?.kind === 'draw-area') {
				if (drawing) drawing = { ...drawing, x2: w.x, y2: w.y };
				return;
			}
			if (dr?.kind === 'move') {
				const nx = w.x + (dr.dx ?? 0);
				const ny = w.y + (dr.dy ?? 0);
				if (dr.target === 'table') updateTable(dr.id!, { x: nx, y: ny });
				else if (dr.target === 'fixture') updateFixture(dr.id!, { x: nx, y: ny });
				else if (dr.target === 'area') updateArea(dr.id!, { x: nx, y: ny });
				return;
			}
			if (dr?.kind === 'rotate') {
				const item = tables.find((x) => x.id === dr.id);
				if (!item) return;
				const a = (Math.atan2(wRaw.y - item.y, wRaw.x - item.x) * 180) / Math.PI;
				let rot = (dr.startRot ?? 0) + (a - (dr.startAngle ?? 0));
				rot = Math.round(rot / 5) * 5;
				rot = (((rot + 180) % 360) + 360) % 360 - 180;
				updateTable(dr.id!, { rot });
				return;
			}
			if (dr?.kind === 'drag-vertex') {
				const wall = walls.find((x) => x.id === dr.wallId);
				if (!wall) return;
				let p = { ...w };
				// Endpoint-snap to other walls' vertices
				let best: Point | null = null;
				let bestD = SNAP_ENDPOINT_CM;
				for (const ww of walls)
					for (let i = 0; i < ww.points.length; i++) {
						if (ww.id === dr.wallId && i === dr.idx) continue;
						const dd = Math.hypot(p.x - ww.points[i].x, p.y - ww.points[i].y);
						if (dd < bestD) {
							best = ww.points[i];
							bestD = dd;
						}
					}
				if (best) p = { x: best.x, y: best.y };
				const prevIdx = (dr.idx ?? 0) > 0 ? (dr.idx ?? 0) - 1 : wall.closed ? wall.points.length - 1 : null;
				if (prevIdx != null && !e.shiftKey) {
					const prev = wall.points[prevIdx];
					p = snapVecAngle(prev.x, prev.y, p.x, p.y);
					p = { x: snapToGrid(p.x), y: snapToGrid(p.y) };
				}
				const oldPt = wall.points[dr.idx ?? 0];
				const moves = [{ from: oldPt, to: p }];
				const updated = walls.map(ww => {
					if (ww.id !== dr.wallId) return ww;
					return { ...ww, points: ww.points.map((pp, i) => i === dr.idx ? p : pp) };
				});
				walls = propagateVertexMoves(updated, moves, dr.wallId);
				return;
			}
			if (dr?.kind === 'move-wall') {
				const dx = w.x - (dr.sx ?? 0);
				const dy = w.y - (dr.sy ?? 0);
				const origPts = dr.originalPoints ?? [];
				const moves = origPts.map(p => ({
					from: p,
					to: { x: snapToGrid(p.x + dx), y: snapToGrid(p.y + dy) },
				}));
				const updated = walls.map((ww) =>
					ww.id === dr.id ? { ...ww, points: moves.map(m => m.to) } : ww
				);
				walls = propagateVertexMoves(updated, moves, dr.id);
				return;
			}
			if (dr?.kind === 'move-seg') {
				const rawDx = w.x - (dr.sx ?? 0), rawDy = w.y - (dr.sy ?? 0);
				const origPts = dr.originalPoints ?? [];
				const segIdx = dr.idx ?? 0;
				const segDx = origPts[1].x - origPts[0].x, segDy = origPts[1].y - origPts[0].y;
				const segLen = Math.hypot(segDx, segDy);
				let pdx: number, pdy: number;
				if (segLen < 1) {
					pdx = rawDx; pdy = rawDy;
				} else {
					const nx = -segDy / segLen, ny = segDx / segLen;
					const proj = rawDx * nx + rawDy * ny;
					pdx = nx * proj; pdy = ny * proj;
				}
				const newA = { x: snapToGrid(origPts[0].x + pdx), y: snapToGrid(origPts[0].y + pdy) };
				const newB = { x: snapToGrid(origPts[1].x + pdx), y: snapToGrid(origPts[1].y + pdy) };
				const moves = [{ from: origPts[0], to: newA }, { from: origPts[1], to: newB }];
				const theWall = walls.find(ww => ww.id === dr.wallId);
				const idxB = (segIdx + 1) % (theWall?.points.length ?? 2);
				const updated = walls.map((ww) => {
					if (ww.id !== dr.wallId) return ww;
					return { ...ww, points: ww.points.map((p, i) => {
						if (i === segIdx) return newA;
						if (i === idxB) return newB;
						return p;
					})};
				});
				walls = propagateVertexMoves(updated, moves, dr.wallId);
				return;
			}
			if (dr?.kind === 'slide-door') {
				const door = doors.find((d) => d.id === dr.id);
				if (!door) return;
				const wall = walls.find((ww) => ww.id === door.wallId);
				if (!wall) return;
				const a = wall.points[door.segIndex ?? 0];
				const b = wall.points[(door.segIndex ?? 0) + 1];
				if (!b) return;
				const c = closestOnSeg(wRaw.x, wRaw.y, a.x, a.y, b.x, b.y);
				let bestSlide = {
					segIndex: door.segIndex ?? 0,
					t: c.t,
					x: c.x,
					y: c.y,
					d: Math.hypot(wRaw.x - c.x, wRaw.y - c.y)
				};
				for (let i = 0; i < wall.points.length - 1; i++) {
					if (i === (door.segIndex ?? 0)) continue;
					const aa = wall.points[i];
					const bb = wall.points[i + 1];
					const cc = closestOnSeg(wRaw.x, wRaw.y, aa.x, aa.y, bb.x, bb.y);
					const dd = Math.hypot(wRaw.x - cc.x, wRaw.y - cc.y);
					if (dd < bestSlide.d - 5) bestSlide = { segIndex: i, t: cc.t, x: cc.x, y: cc.y, d: dd };
				}
				updateDoor(dr.id!, { segIndex: bestSlide.segIndex, t: bestSlide.t });
				return;
			}
		};

		const onUp = () => {
			if (dragRef?.kind === 'draw-area' && drawing && drawing.kind === 'area') {
				const x = Math.min(drawing.x1!, drawing.x2!);
				const y = Math.min(drawing.y1!, drawing.y2!);
				const dw = Math.abs(drawing.x2! - drawing.x1!);
				const dh = Math.abs(drawing.y2! - drawing.y1!);
				if (dw > 30 && dh > 30) {
					pushUndo();
					const id = `a-${Date.now().toString(36)}`;
					areas = [...areas, { id, name: 'New area', x, y, w: dw, h: dh, tint: 'main' }];
					select('area', id);
				}
				drawing = null;
				tool = 'select';
			}
			dragRef = null;
		};

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
		return () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};
	});

	// ─── Keyboard handler ────────────────────────────────────────────────────
	$effect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === ' ') { e.preventDefault(); spaceHeld = true; return; }
			if (mode !== 'edit') return;
			if (['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement as HTMLElement)?.tagName))
				return;

			// Undo: Cmd/Ctrl+Z
			if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
				e.preventDefault();
				undo();
				return;
			}
			// Redo: Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y
			if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || e.key === 'y')) {
				e.preventDefault();
				redo();
				return;
			}

			if (e.key === 'Escape') {
				if (drawing) drawing = null;
				tool = 'select';
				selected = null;
				return;
			}
			if (e.key === 'Enter' && drawing?.kind === 'wall') {
				if (drawing.points && drawing.points.length >= 2) {
					pushUndo();
					const id = `w-${Date.now().toString(36)}`;
					walls = [...walls, { id, closed: false, thickness: 6, points: drawing.points }];
				}
				drawing = null;
				tool = 'select';
				return;
			}
			if (!selected) return;
			pushUndo();
			const step = e.shiftKey ? 20 : 5;
			let dx = 0;
			let dy = 0;
			let drot = 0;
			if (e.key === 'ArrowLeft') dx = -step;
			else if (e.key === 'ArrowRight') dx = step;
			else if (e.key === 'ArrowUp') dy = -step;
			else if (e.key === 'ArrowDown') dy = step;
			else if (e.key === 'r' || e.key === 'R') drot = 15;
			else if (e.key === 'Delete' || e.key === 'Backspace') {
				e.preventDefault();
				deleteSelected();
				return;
			} else return;
			e.preventDefault();
			const k = selected.kind;
			const id = selected.id;
			if (k === 'table') {
				const t = tables.find((x) => x.id === id);
				if (t) updateTable(id, { x: t.x + dx, y: t.y + dy, rot: (t.rot || 0) + drot });
			} else if (k === 'fixture') {
				const f = fixtures.find((x) => x.id === id);
				if (f) updateFixture(id, { x: f.x + dx, y: f.y + dy });
			} else if (k === 'area') {
				const a = areas.find((x) => x.id === id);
				if (a) updateArea(id, { x: a.x + dx, y: a.y + dy });
			} else if (k === 'vertex') {
				const [wallId, idxS] = id.split('::');
				const idx2 = +idxS;
				const wall = walls.find((w) => w.id === wallId);
				if (wall) {
					const p = wall.points[idx2];
					updateWallPoint(wallId, idx2, { x: p.x + dx, y: p.y + dy });
				}
			}
		};
		const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') spaceHeld = false; };
		window.addEventListener('keydown', onKey);
		window.addEventListener('keyup', onKeyUp);
		return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
	});

	// ─── Wall drawing preview computed data ──────────────────────────────────
	const wallPreview = $derived.by(() => {
		if (drawing?.kind !== 'wall' || !mouseWorld || !drawing.points || drawing.points.length === 0) return null;
		const last = drawing.points[drawing.points.length - 1];
		const snapped = snapToEndpoints(mouseWorld);
		const pt = snapVecAngle(last.x, last.y, snapped.x, snapped.y);
		const ptSnapped = { x: snapToGrid(pt.x), y: snapToGrid(pt.y) };
		const len = dist(last, ptSnapped);
		return { last, snapped, ptSnapped, len, isEndpointSnap: (snapped as any).snapped === 'endpoint' };
	});

	// ─── Helper: get selected wall for vertex handles ────────────────────────
	const selectedWall = $derived.by(() => {
		if (!selected) return null;
		if (selected.kind !== 'wall' && selected.kind !== 'vertex' && selected.kind !== 'segment') return null;
		const wallId = selected.kind === 'wall' ? selected.id : selected.id.split('::')[0];
		return walls.find((x) => x.id === wallId) ?? null;
	});

	// ─── Helper for editor panel: get selected item ──────────────────────────
	function getSelectedItem() {
		if (!selected) return null;
		const { kind, id } = selected;
		if (kind === 'table') return { kind, item: tables.find((t) => t.id === id) };
		if (kind === 'wall') return { kind, item: walls.find((w) => w.id === id) };
		if (kind === 'door') return { kind, item: doors.find((d) => d.id === id) };
		if (kind === 'fixture') return { kind, item: fixtures.find((f) => f.id === id) };
		if (kind === 'area') return { kind, item: areas.find((a) => a.id === id) };
		if (kind === 'vertex') {
			const [wallId, idxS] = id.split('::');
			const wall = walls.find((w) => w.id === wallId);
			return { kind, item: wall, idx: +idxS };
		}
		if (kind === 'segment') {
			const [wallId, idxS] = id.split('::');
			const wall = walls.find((w) => w.id === wallId);
			return { kind, item: wall, idx: +idxS };
		}
		return null;
	}

	function addTable(template: { l: string; shape: 'round' | 'rect'; seats: number; d?: number; w?: number; h?: number }) {
		let n = tables.length + 1;
		let newId = `T${n}`;
		const taken = new Set(tables.map((x) => x.id));
		while (taken.has(newId)) {
			n++;
			newId = `T${n}`;
		}
		const newTable: FloorTable = {
			id: newId,
			area: 'Main',
			floorId: activeFloor.id,
			x: 700,
			y: 450,
			status: 'available',
			rot: 0,
			shape: template.shape,
			seats: template.seats,
			d: template.d,
			w: template.w,
			h: template.h
		};
		pushUndo();
		tables = [...tables, newTable];
		selected = { kind: 'table', id: newId };
	}

	const confirmedReservations = $derived(
		data.reservations
			.filter((r: NormalizedReservation) => r.status === 'confirmed')
			.slice(0, 6)
	);
</script>

<div style="position: relative; flex: 1; display: flex; flex-direction: column; overflow: hidden">
	<!-- Floating toolbar -->
	<div style="position: absolute; top: 0.75rem; left: 0.75rem; right: 0.75rem; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 0.625rem; padding: 0.375rem 0.625rem; background: color-mix(in oklch, var(--fr-surface) 92%, transparent); backdrop-filter: blur(12px); border: 1px solid var(--fr-border); border-radius: var(--fr-radius); box-shadow: var(--fr-shadow-md)">
		<div style="display: flex; align-items: center; gap: 0.625rem">
			<span class="fr-subtle" style="font-size: 0.75rem; white-space: nowrap">
				{#if mode === 'edit'}
					Arrange mode{#if collisions.size > 0} · <span style="color: var(--fr-danger)">{collisions.size} issue{collisions.size > 1 ? 's' : ''}</span>{/if}
				{:else}
					{counts.seated + counts.reserved}/{tables.length} tables · {occupiedSeats}/{totalSeats} seats
				{/if}
			</span>
		</div>
		<div class="fr-row" style="gap: 0.5rem">
			<div class="fr-segment">
				<button class:active={mode === 'service'} onclick={() => { mode = 'service'; selected = null; }}>Service</button>
				<button class:active={mode === 'edit'} onclick={() => { mode = 'edit'; }}>Arrange tables</button>
			</div>
			{#if floors.length > 1}
				<div class="fr-segment">
					{#each floors as floor (floor.id)}
						<button class:active={activeFloorId === floor.id} onclick={() => {
						activeFloorId = floor.id;
						const target = tables.filter(t => t.floorId === floor.id);
						requestAnimationFrame(() => fitToContent(target.length > 0 ? target : undefined));
					}}>{floor.name}</button>
					{/each}
				</div>
			{/if}
			<div class="fr-segment">
				{#each ['All', 'Main', 'Bar', 'Garden', 'Private'] as a (a)}
					<button class:active={area === a} onclick={() => {
						area = a;
						if (a === 'All') {
							requestAnimationFrame(() => fitToContent(undefined, true, true));
						} else {
							const target = floorTables.filter(t => t.area === a);
							if (target.length > 0) requestAnimationFrame(() => fitToContent(target));
						}
					}}>{a}</button>
				{/each}
			</div>
			<!-- Layout switcher -->
			{#if (data.layouts ?? []).length > 0}
				<button class="fr-btn fr-btn-sm" onclick={(e) => { showLayoutMenu = !showLayoutMenu; if (!showLayoutMenu) return; const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); layoutMenuPos = { x: r.left, y: r.bottom + 6 }; }}><Layers size={13} /> {activeLayoutName} <ChevronDown size={12} /></button>
			{/if}
			{#if mode === 'service'}
				<button class="fr-btn {editingSections ? 'fr-btn-primary' : ''}" onclick={() => { editingSections = !editingSections; serviceTableId = null; }}><Users size={14} /> Sections</button>
				<button class="fr-btn fr-btn-primary"><Plus size={14} /> Walk-in</button>
			{:else}
				<button class="fr-btn fr-btn-primary" onclick={async (e) => {
					const btn = e.currentTarget as HTMLButtonElement;
					btn.disabled = true;
					btn.textContent = 'Saving...';
					const layout = {
						floors,
						tables: tables.map(t => ({
							id: t.id, area: t.area, floorId: t.floorId, shape: t.shape, x: t.x, y: t.y,
							d: t.d, w: t.w, h: t.h, rot: t.rot, seats: t.seats, status: t.status
						})),
					};
					const fd = new FormData();
					fd.set('layout', JSON.stringify(layout));
					await fetch('/dashboard/floor?/saveLayout', { method: 'POST', body: fd });
					const { invalidateAll } = await import('$app/navigation');
					await invalidateAll();
					btn.disabled = false;
					btn.innerHTML = '';
					btn.textContent = '✓ Saved';
					mode = 'service';
					setTimeout(() => { btn.textContent = 'Save layout'; }, 2000);
				}}><Check size={14} /> Save layout</button>
				<button class="fr-btn" onclick={() => { showSaveAsDialog = true; }}><Save size={14} /> Save as...</button>
			{/if}
		</div>
	</div>

		<!-- Canvas (fills entire content area) -->
		<div style="position: absolute; inset: 0; overflow: hidden; background: var(--fr-bg)">
			<!-- Top-left: toggle buttons (below floating toolbar) -->
			<div style="position: absolute; left: 0.75rem; top: 3.75rem; z-index: 5; display: flex; gap: 0.375rem; flex-wrap: wrap">
				<button class="fr-btn fr-btn-sm" onclick={() => { showSeats = !showSeats; }}><Users size={13} /> Seats {showSeats ? 'on' : 'off'}</button>
				<button class="fr-btn fr-btn-sm" onclick={() => { showGrid = !showGrid; }}><LayoutGrid size={13} /> Grid {showGrid ? 'on' : 'off'}</button>
				{#if mode === 'edit'}
					<button class="fr-btn fr-btn-sm" onclick={() => { showDims = !showDims; }}><Tag size={13} /> Dims {showDims ? 'on' : 'off'}</button>
					<button class="fr-btn fr-btn-sm" onclick={() => { showCollisions = !showCollisions; }} style="color: {collisions.size > 0 && showCollisions ? 'var(--fr-danger)' : 'inherit'}"><Zap size={13} /> Collisions{collisions.size > 0 && showCollisions ? ` · ${collisions.size}` : ''}</button>
				{/if}
			</div>

			<!-- Table manager has no architectural tool palette — that's in Settings > Floor plan -->

			<!-- Bottom-right: zoom -->
			<div style="position: absolute; right: 0.75rem; bottom: 0.75rem; z-index: 11">
				<div class="fr-segment" style="background: color-mix(in oklch, var(--fr-surface-muted) 80%, transparent); backdrop-filter: blur(12px)">
					<button onclick={() => { cancelAnimationFrame(animFrame); zoom = Math.max(0.5, zoom - 0.15); }}>&minus;</button>
					<span style="font-size: 12px; font-variant-numeric: tabular-nums; display: grid; place-items: center; min-width: 44px; color: var(--fr-text-muted)">{Math.round(zoom * 100)}%</span>
					<button onclick={() => { cancelAnimationFrame(animFrame); zoom = Math.min(2, zoom + 0.15); }}>+</button>
				</div>
			</div>

			<!-- Keyboard hints (bottom-left, above scale bar) -->
			{#if mode === 'edit' && tool === 'select' && selected?.kind === 'table'}
				<div style="position: absolute; left: 0.75rem; bottom: 3rem; z-index: 5; padding: 0.375rem 0.625rem; background: var(--fr-surface); border: 1px solid var(--fr-border); border-radius: var(--fr-radius); font-size: 0.6875rem; color: var(--fr-text-muted); font-family: var(--fr-font-mono)">
					&larr; &rarr; &uarr; &darr; nudge · ⇧+arrows jump · R rotate · Del delete · ⌘Z undo · ⌘⇧Z redo
				</div>
			{/if}
			{#if mode === 'edit' && drawing?.kind === 'wall'}
				<div style="position: absolute; left: 0.75rem; bottom: 3rem; z-index: 5; padding: 0.375rem 0.625rem; background: var(--fr-surface); border: 1px solid var(--fr-accent); border-radius: var(--fr-radius); font-size: 0.72rem; color: var(--fr-accent); font-weight: 500; font-family: var(--fr-font-mono)">
					{drawing.points?.length ?? 0} pt{(drawing.points?.length ?? 0) > 1 ? 's' : ''} · Enter finish · Shift free angle · esc cancel
				</div>
			{/if}

			<!-- SVG Canvas -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				style="width: 100%; height: 100%; overflow: hidden"
				onwheel={(e) => {
					e.preventDefault();
					cancelAnimationFrame(animFrame);
					const oldZoom = zoom;
					const delta = e.deltaY > 0 ? -0.08 : 0.08;
					const newZoom = Math.max(0.3, Math.min(3, oldZoom + delta));
					if (svgRef) {
						const rect = svgRef.getBoundingClientRect();
						const mx = (e.clientX - rect.left) / rect.width;
						const my = (e.clientY - rect.top) / rect.height;
						const oldW = W / oldZoom, oldH = H / oldZoom;
						const newW = W / newZoom, newH = H / newZoom;
						panX += (oldW - newW) * mx;
						panY += (oldH - newH) * my;
					}
					zoom = newZoom;
				}}
			>
				<svg
					bind:this={svgRef}
					viewBox="{vbX} {vbY} {vbW} {vbH}"
					preserveAspectRatio="xMidYMid meet"
					onmousedown={onCanvasMouseDown}
					onmousemove={onCanvasMouseMove}
					style="width: 100%; height: 100%; display: block; cursor: {dragRef?.kind === 'pan' ? 'grabbing' : spaceHeld ? 'grab' : mode === 'edit' && tool !== 'select' ? 'crosshair' : 'grab'}"
				>
					<defs>
						<pattern id="fp-grid-minor" width={GRID_MINOR_CM * PX_PER_CM} height={GRID_MINOR_CM * PX_PER_CM} patternUnits="userSpaceOnUse">
							<path d="M {GRID_MINOR_CM * PX_PER_CM} 0 L 0 0 0 {GRID_MINOR_CM * PX_PER_CM}" fill="none" stroke="var(--fr-border)" stroke-width="0.4" opacity="0.4" />
						</pattern>
						<pattern id="fp-grid-major" width={GRID_CM * PX_PER_CM} height={GRID_CM * PX_PER_CM} patternUnits="userSpaceOnUse">
							<path d="M {GRID_CM * PX_PER_CM} 0 L 0 0 0 {GRID_CM * PX_PER_CM}" fill="none" stroke="var(--fr-border-strong)" stroke-width="0.7" opacity="0.55" />
						</pattern>
						<pattern id="fp-floor" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
							<line x1="0" y1="0" x2="0" y2="60" stroke="var(--fr-border)" stroke-width="0.6" opacity="0.4" />
						</pattern>
						<pattern id="fp-garden" width="14" height="14" patternUnits="userSpaceOnUse">
							<circle cx="2" cy="2" r="1" fill="var(--fr-success)" opacity="0.18" />
						</pattern>
						<pattern id="fp-banq" width="10" height="10" patternUnits="userSpaceOnUse">
							<line x1="0" y1="0" x2="10" y2="10" stroke="var(--fr-border-strong)" stroke-width="0.8" opacity="0.6" />
						</pattern>
						<pattern id="fp-collide" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
							<line x1="0" y1="0" x2="0" y2="8" stroke="var(--fr-danger)" stroke-width="2" opacity="0.45" />
						</pattern>
					</defs>

					<!-- Areas -->
					<g>
						{#each areas as a (a.id)}
							{@const tint = AREA_TINT[a.tint] || AREA_TINT.main}
							{@const sel = isSel('area', a.id)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<g onmousedown={(e) => onItemMouseDown(e, 'area', a.id)} style="cursor: {mode === 'edit' && tool === 'select' ? 'move' : 'default'}">
								<rect x={a.x} y={a.y} width={a.w} height={a.h} fill={tint.bg} stroke={sel ? 'var(--fr-accent)' : 'transparent'} stroke-width={sel ? 2 : 0} stroke-dasharray={sel ? '4 3' : ''} />
								{#if tint.overlay}
									<rect x={a.x} y={a.y} width={a.w} height={a.h} fill={tint.overlay} pointer-events="none" />
								{/if}
							</g>
						{/each}
					</g>

					<!-- Grid -->
					{#if showGrid}
						<rect x="0" y="0" width={vbW} height={vbH} fill="url(#fp-grid-minor)" pointer-events="none" />
						<rect x="0" y="0" width={vbW} height={vbH} fill="url(#fp-grid-major)" pointer-events="none" />
					{/if}

					<!-- Walls -->
					<g>
						{#each walls as w (w.id)}
							{@const isWallSelected = selectedWall?.id === w.id}
							{@const selSegIdx = selected?.kind === 'segment' && selected.id.startsWith(w.id + '::') ? +selected.id.split('::')[1] : -1}
							{@const d = w.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (w.closed ? ' Z' : '')}
							<g>
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<path d={d} fill="none" stroke="transparent" stroke-width={Math.max(w.thickness + 8, 14)} stroke-linecap="square"
									onmousedown={(e) => onItemMouseDown(e, 'wall', w.id)} style="cursor: {mode === 'edit' && tool === 'select' ? 'move' : 'default'}" />
								<path d={d} fill="none" stroke="var(--fr-text)" stroke-width={w.thickness} stroke-linecap="square" stroke-linejoin="miter" opacity={isWallSelected ? 0.5 : 0.85} pointer-events="none" />
								{#if selSegIdx >= 0}
									{@const a = w.points[selSegIdx]}
									{@const b = w.points[(selSegIdx + 1) % w.points.length]}
									<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--fr-accent)" stroke-width={w.thickness + 2} stroke-linecap="square" pointer-events="none" />
								{/if}
							</g>
						{/each}
					</g>

					<!-- Wall dimensions (selected wall) -->
					{#if showDims && mode === 'edit'}
						<g style="pointer-events: none">
							{#each walls as w (w.id)}
								{@const sel = isSel('wall', w.id) || (selected?.kind === 'vertex' && selected.id.startsWith(w.id + '::')) || (selected?.kind === 'segment' && selected.id.startsWith(w.id + '::'))}
								{#if sel}
									{@const segCount = w.closed ? w.points.length : w.points.length - 1}
									{#each { length: segCount } as _, i}
										{@const a = w.points[i]}
										{@const b = w.points[(i + 1) % w.points.length]}
										{@const len = dist(a, b)}
										{#if len >= 10}
											{@const mx = (a.x + b.x) / 2}
											{@const my = (a.y + b.y) / 2}
											{@const nx = -(b.y - a.y) / len}
											{@const ny = (b.x - a.x) / len}
											{@const lx = mx + nx * 14}
											{@const ly = my + ny * 14}
											{@const angleDeg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI}
											<g>
												<line x1={a.x + nx * 8} y1={a.y + ny * 8} x2={b.x + nx * 8} y2={b.y + ny * 8} stroke="var(--fr-accent)" stroke-width="0.8" />
												<line x1={a.x} y1={a.y} x2={a.x + nx * 12} y2={a.y + ny * 12} stroke="var(--fr-accent)" stroke-width="0.8" />
												<line x1={b.x} y1={b.y} x2={b.x + nx * 12} y2={b.y + ny * 12} stroke="var(--fr-accent)" stroke-width="0.8" />
												<g transform="translate({lx} {ly}) rotate({angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg})">
													<rect x="-22" y="-8" width="44" height="14" rx="2" fill="var(--fr-surface)" stroke="var(--fr-accent)" stroke-width="0.5" />
													<text x="0" y="3" text-anchor="middle" font-size="10" font-family="var(--fr-font-mono)" fill="var(--fr-accent)" font-weight="600">{fmtLen(len / PX_PER_CM, units)}</text>
												</g>
											</g>
										{/if}
									{/each}
								{/if}
							{/each}
						</g>
					{/if}

					<!-- In-progress wall preview -->
					{#if wallPreview}
						<g style="pointer-events: none">
							<path d={drawing!.points!.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} fill="none" stroke="var(--fr-accent)" stroke-width="5" stroke-dasharray="6 4" opacity="0.8" />
							<line x1={wallPreview.last.x} y1={wallPreview.last.y} x2={wallPreview.ptSnapped.x} y2={wallPreview.ptSnapped.y} stroke="var(--fr-accent)" stroke-width="3" stroke-dasharray="4 3" opacity="0.6" />
							{#each drawing!.points! as p, i (i)}
								<circle cx={p.x} cy={p.y} r="4" fill="var(--fr-accent)" />
							{/each}
							<circle cx={wallPreview.ptSnapped.x} cy={wallPreview.ptSnapped.y} r="5" fill="var(--fr-surface)" stroke="var(--fr-accent)" stroke-width="2" />
							{#if wallPreview.isEndpointSnap}
								<circle cx={wallPreview.ptSnapped.x} cy={wallPreview.ptSnapped.y} r="9" fill="none" stroke="var(--fr-accent)" stroke-width="1" stroke-dasharray="2 2" />
							{/if}
							{#if wallPreview.len > 10}
								<g transform="translate({(wallPreview.last.x + wallPreview.ptSnapped.x) / 2} {(wallPreview.last.y + wallPreview.ptSnapped.y) / 2 - 14})">
									<rect x="-26" y="-9" width="52" height="16" rx="3" fill="var(--fr-accent)" />
									<text x="0" y="3" text-anchor="middle" font-size="11" font-family="var(--fr-font-mono)" fill="white" font-weight="600">{fmtLen(wallPreview.len / PX_PER_CM, units)}</text>
								</g>
							{/if}
						</g>
					{/if}

					<!-- In-progress area preview -->
					{#if drawing?.kind === 'area'}
						<rect
							x={Math.min(drawing.x1!, drawing.x2!)}
							y={Math.min(drawing.y1!, drawing.y2!)}
							width={Math.abs(drawing.x2! - drawing.x1!)}
							height={Math.abs(drawing.y2! - drawing.y1!)}
							fill="color-mix(in oklch, var(--fr-accent) 10%, transparent)"
							stroke="var(--fr-accent)"
							stroke-width="1.5"
							stroke-dasharray="4 3"
							pointer-events="none"
						/>
					{/if}

					<!-- Doors -->
					<g>
						{#each doors as d (d.id)}
							{@const sel = isSel('door', d.id)}
							{@const geom = getDoorGeometry(d)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<g onmousedown={(e) => onItemMouseDown(e, 'door', d.id)} style="cursor: {mode === 'edit' && tool === 'select' ? 'move' : (mode === 'service' ? 'default' : 'default')}">
								<line x1={geom.pos.x} y1={geom.pos.y} x2={geom.panelEndX} y2={geom.panelEndY} stroke="transparent" stroke-width="16" stroke-linecap="round" />
								<line x1={geom.pos.x} y1={geom.pos.y} x2={geom.closedEndX} y2={geom.closedEndY} stroke="var(--fr-bg)" stroke-width="11" stroke-linecap="butt" />
								<path
									d="M {geom.closedEndX} {geom.closedEndY} A {d.width} {d.width} 0 0 {geom.openRad >= 0 ? 1 : 0} {geom.panelEndX} {geom.panelEndY}"
									fill="none"
									stroke={sel ? 'var(--fr-accent)' : 'var(--fr-border-strong)'}
									stroke-width="1"
									stroke-dasharray="4 3"
									opacity="0.7"
								/>
								<line x1={geom.pos.x} y1={geom.pos.y} x2={geom.panelEndX} y2={geom.panelEndY} stroke={sel ? 'var(--fr-accent)' : 'var(--fr-text)'} stroke-width="3" stroke-linecap="round" opacity="0.9" />
								<circle cx={geom.pos.x} cy={geom.pos.y} r="4" fill={sel ? 'var(--fr-accent)' : 'var(--fr-text)'} />
								{#if d.label}
									<text x={(geom.pos.x + geom.closedEndX) / 2} y={(geom.pos.y + geom.closedEndY) / 2 - 10} text-anchor="middle" font-size="10" fill="var(--fr-text-subtle)" style="text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500; pointer-events: none">{d.label}</text>
								{/if}
							</g>
						{/each}
					</g>

					<!-- Vertex handles for selected wall -->
					{#if mode === 'edit' && tool === 'select' && selectedWall}
						{@const sw = selectedWall}
						{@const segCount2 = sw.closed ? sw.points.length : sw.points.length - 1}
						<g>
							<!-- Midpoint handles -->
							{#each { length: segCount2 } as _, i}
								{@const a = sw.points[i]}
								{@const b = sw.points[(i + 1) % sw.points.length]}
								{@const mx = (a.x + b.x) / 2}
								{@const my = (a.y + b.y) / 2}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<circle cx={mx} cy={my} r="7" fill="var(--fr-surface)" stroke="var(--fr-accent)" stroke-width="1.5" stroke-dasharray="2 2" style="cursor: crosshair"
								onmousedown={(e) => {
									e.stopPropagation(); e.preventDefault();
									if (spaceHeld) { dragRef = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, startPanX: panX, startPanY: panY }; return; }
									pushUndo();
									const start = toWorld(e.clientX, e.clientY);
									selected = { kind: 'segment', id: `${sw.id}::${i}` };
									const origA = { ...sw.points[i] };
									const origB = { ...sw.points[(i + 1) % sw.points.length] };
									dragRef = { kind: 'move-seg', wallId: sw.id, idx: i, sx: start.x, sy: start.y, originalPoints: [origA, origB] };
								}}
								ondblclick={(e) => onMidpointMouseDown(e, sw.id, i)} />
							{/each}
							<!-- Vertex handles -->
							{#each sw.points as p, i (i)}
								{@const isSelV = selected?.kind === 'vertex' && selected.id === `${sw.id}::${i}`}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<rect x={p.x - 5} y={p.y - 5} width="10" height="10" fill={isSelV ? 'var(--fr-accent)' : 'var(--fr-surface)'} stroke="var(--fr-accent)" stroke-width="2" style="cursor: move" onmousedown={(e) => onVertexMouseDown(e, sw.id, i)} />
							{/each}
						</g>
					{/if}

					<!-- Fixtures -->
					<g>
						{#each fixtures as f (f.id)}
							{@const sel = isSel('fixture', f.id)}
							{@const stroke = sel ? 'var(--fr-accent)' : 'var(--fr-border-strong)'}
							{#if f.kind === 'banq'}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<g onmousedown={(e) => onItemMouseDown(e, 'fixture', f.id)} style="cursor: {mode === 'edit' && tool === 'select' ? 'move' : 'default'}">
									<rect x={f.x} y={f.y} width={f.w} height={f.h} fill="url(#fp-banq)" stroke={stroke} stroke-width={sel ? 2 : 1} />
								</g>
							{:else if f.kind === 'planter'}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<g onmousedown={(e) => onItemMouseDown(e, 'fixture', f.id)} style="cursor: {mode === 'edit' && tool === 'select' ? 'move' : 'default'}">
									<circle cx={f.x + f.w / 2} cy={f.y + f.h / 2} r={f.w / 2} fill="color-mix(in oklch, var(--fr-success) 22%, var(--fr-surface))" stroke={sel ? 'var(--fr-accent)' : 'color-mix(in oklch, var(--fr-success) 50%, var(--fr-border))'} stroke-width={sel ? 2 : 1.5} />
									<text x={f.x + f.w / 2} y={f.y + f.h / 2 + 4} text-anchor="middle" font-size="10" fill="var(--fr-success)" font-weight="500" pointer-events="none">&#10086;</text>
								</g>
							{:else}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<g onmousedown={(e) => onItemMouseDown(e, 'fixture', f.id)} style="cursor: {mode === 'edit' && tool === 'select' ? 'move' : 'default'}">
									<rect x={f.x} y={f.y} width={f.w} height={f.h} fill={f.kind === 'fire' ? 'color-mix(in oklch, var(--fr-warn) 18%, var(--fr-surface))' : 'var(--fr-surface-muted)'} stroke={stroke} stroke-width={sel ? 2 : 1} />
									{#if f.label}
										<text x={f.x + f.w / 2} y={f.y + f.h / 2 + 4} text-anchor="middle" font-size="11" fill="var(--fr-text-muted)" font-weight="500" style="text-transform: uppercase; letter-spacing: 0.06em; pointer-events: none">{f.label}</text>
									{/if}
								</g>
							{/if}
						{/each}
					</g>

					<!-- Area labels -->
					<g style="pointer-events: none">
						{#each areas as a (a.id)}
							<text x={a.x + a.w / 2} y={a.y + 22} text-anchor="middle" font-size={a.w > 500 ? 13 : 11} fill="var(--fr-text-subtle)" font-weight="600" style="text-transform: uppercase; letter-spacing: 0.14em">{a.name}</text>
						{/each}
					</g>

					<!-- Tables -->
					<g>
						{#each tablesAug as t (t.id)}
							{@const s = STATUS_THEME[t.status]}
							{@const tSel = isSel('table', t.id)}
							{@const isHov = hover === t.id}
							{@const isColliding = collisions.has(t.id)}
							{@const seats = computeSeats(t)}
							{@const rot = t.rot || 0}
							{@const haloR = t.shape === 'round' ? (t.d ?? 80) / 2 + 24 : Math.max(t.w ?? 100, t.h ?? 80) / 2 + 28}
							<g>
								<!-- Collision halo -->
								{#if isColliding && showCollisions}
									<circle cx={t.x} cy={t.y} r={haloR + 4} fill="url(#fp-collide)" stroke="var(--fr-danger)" stroke-width="1.5" stroke-dasharray="6 3" opacity="0.7" pointer-events="none" />
								{/if}

								<!-- Section color ring -->
								{#if editingSections && editSectionId && newSectionTableIds.includes(t.id)}
									{@const secR = t.shape === 'round' ? (t.d ?? 80) / 2 + 6 : Math.max(t.w ?? 100, t.h ?? 80) / 2 + 8}
									<circle cx={t.x} cy={t.y} r={secR} fill="none" stroke={newSectionColor} stroke-width="4" opacity="0.8" pointer-events="none" />
								{:else if t.section && showSections && mode === 'service'}
									{@const secR = t.shape === 'round' ? (t.d ?? 80) / 2 + 6 : Math.max(t.w ?? 100, t.h ?? 80) / 2 + 8}
									<circle cx={t.x} cy={t.y} r={secR} fill="none" stroke={t.section.color} stroke-width="3" opacity="0.6" pointer-events="none" />
								{/if}

								<!-- Seats (chair backs, rendered before table so they tuck behind) -->
								{#if showSeats}
									{#each seats as seat, i (i)}
										{@const cw = t.shape === 'round' ? 22 : 24}
										{@const ch = 10}
										{@const occupied = t.status === 'seated' && i < (t.res ? Math.min(t.res.party, t.seats) : t.seats)}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<g onmousedown={(e) => onItemMouseDown(e, 'table', t.id)} onmouseenter={() => { hover = t.id; }} onmouseleave={() => { hover = null; }} style="cursor: {mode === 'edit' && tool === 'select' ? 'move' : (t.res ? 'pointer' : 'default')}">
											<rect
												x={-cw / 2} y={-ch / 2}
												width={cw} height={ch}
												rx="4"
												fill={occupied ? s.accent : 'var(--fr-surface)'}
												stroke={s.accent}
												stroke-width="1.2"
												opacity={t.status === 'blocked' ? 0.35 : (occupied ? 0.85 : 1)}
												transform="translate({seat.x} {seat.y}) rotate({seat.angle})"
											/>
										</g>
									{/each}
								{/if}

								<!-- Table body -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<g transform="translate({t.x} {t.y}) rotate({rot})" onmousedown={(e) => onItemMouseDown(e, 'table', t.id)} onmouseenter={() => { hover = t.id; }} onmouseleave={() => { hover = null; }} style="cursor: {mode === 'edit' && tool === 'select' ? 'move' : (t.res ? 'pointer' : 'default')}">
									{#if t.shape === 'round'}
										<circle cx={0} cy={0} r={(t.d ?? 80) / 2} fill={s.fill} stroke={tSel ? 'var(--fr-accent)' : (isColliding ? 'var(--fr-danger)' : s.stroke)} stroke-width={tSel ? 2.5 : (isColliding ? 2 : 1.5)} />
									{:else}
										<rect x={-(t.w ?? 100) / 2} y={-(t.h ?? 80) / 2} width={t.w ?? 100} height={t.h ?? 80} rx="6" fill={s.fill} stroke={tSel ? 'var(--fr-accent)' : (isColliding ? 'var(--fr-danger)' : s.stroke)} stroke-width={tSel ? 2.5 : (isColliding ? 2 : 1.5)} />
									{/if}
									{#if t.shape === 'rect'}
										<line x1={-(t.w ?? 100) / 2 + 6} y1={-(t.h ?? 80) / 2 + 4} x2={(t.w ?? 100) / 2 - 6} y2={-(t.h ?? 80) / 2 + 4} stroke={s.accent} stroke-width="1.5" opacity="0.4" />
									{/if}
									<!-- Hover / selection ring -->
									{#if isHov || tSel}
										{#if t.shape === 'round'}
											<circle cx={0} cy={0} r={(t.d ?? 80) / 2 + (tSel ? 6 : 3)} fill="none" stroke={tSel ? 'var(--fr-accent)' : s.accent} stroke-width={tSel ? 1.2 : 1.5} stroke-dasharray={tSel ? '3 3' : ''} opacity={tSel ? 1 : 0.5} />
										{:else}
											<rect x={-(t.w ?? 100) / 2 - (tSel ? 6 : 3)} y={-(t.h ?? 80) / 2 - (tSel ? 6 : 3)} width={(t.w ?? 100) + (tSel ? 12 : 6)} height={(t.h ?? 80) + (tSel ? 12 : 6)} rx={tSel ? 8 : 9} fill="none" stroke={tSel ? 'var(--fr-accent)' : s.accent} stroke-width={tSel ? 1.2 : 1.5} stroke-dasharray={tSel ? '3 3' : ''} opacity={tSel ? 1 : 0.5} />
										{/if}
									{/if}
								</g>

								<!-- Table label -->
								<g style="pointer-events: none">
									{#if t.res && mode === 'service'}
										<text x={t.x} y={t.y - 6} text-anchor="middle" font-size="11" font-weight="600" fill="var(--fr-text)" style="font-variant-numeric: tabular-nums">{t.id}</text>
										<text x={t.x} y={t.y + 8} text-anchor="middle" font-size="11" font-weight="600" fill="var(--fr-text)">{t.res.guest.split(' ').pop()}</text>
										<text x={t.x} y={t.y + 21} text-anchor="middle" font-size="9" fill="var(--fr-text-muted)" font-weight="500">{t.res.party}p · {t.res.time}</text>
									{:else}
										<text x={t.x} y={t.y - 2} text-anchor="middle" font-size="13" font-weight="700" fill="var(--fr-text)" style="font-variant-numeric: tabular-nums">{t.id}</text>
										<text x={t.x} y={t.y + 14} text-anchor="middle" font-size="10" fill="var(--fr-text-muted)" font-weight="500">{t.seats} top</text>
									{/if}
								</g>

								<!-- Seated timer badge (service mode) -->
								{#if t.res && t.res.status === 'seated' && mode === 'service'}
									{@const seatedMins = Math.max(0, Math.round((Date.now() - new Date(t.res.date + 'T' + t.res.time).getTime()) / 60000))}
									{@const timerText = seatedMins >= 60 ? `${Math.floor(seatedMins / 60)}h${String(seatedMins % 60).padStart(2, '0')}` : `${seatedMins}m`}
									{@const badgeY = t.y + (t.shape === 'round' ? (t.d ?? 80) / 2 : (t.h ?? 80) / 2) + 18}
									<g style="pointer-events: none">
										<rect x={t.x - 20} y={badgeY} width="40" height="18" rx="9" fill={seatedMins > 90 ? 'var(--fr-warn)' : 'var(--fr-text-muted)'} opacity="0.9" />
										<text x={t.x} y={badgeY + 13} text-anchor="middle" font-size="10" font-weight="600" fill="white" font-family="var(--fr-font-mono)">{timerText}</text>
									</g>
								{/if}

								<!-- Rotate handle (edit mode) -->
								{#if mode === 'edit' && tSel && tool === 'select'}
									{@const offset = t.shape === 'round' ? (t.d ?? 80) / 2 + 32 : (t.h ?? 80) / 2 + 32}
									{@const rad2 = ((rot - 90) * Math.PI) / 180}
									{@const hx = t.x + Math.cos(rad2) * offset}
									{@const hy = t.y + Math.sin(rad2) * offset}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<g onmousedown={(e) => onRotateMouseDown(e, t)} style="cursor: grab">
										<line x1={t.x} y1={t.y} x2={hx} y2={hy} stroke="var(--fr-accent)" stroke-width="1" stroke-dasharray="2 3" opacity="0.6" />
										<circle cx={hx} cy={hy} r={9} fill="var(--fr-surface)" stroke="var(--fr-accent)" stroke-width="2" />
									</g>
								{/if}
							</g>
						{/each}
					</g>

					<!-- Hover tooltip (service mode) -->
					{#if hover}
						{@const ht = tablesAug.find((x) => x.id === hover)}
						{#if ht && ht.res && mode !== 'edit'}
							{@const tx = ht.x + (ht.shape === 'round' ? (ht.d ?? 80) / 2 : (ht.w ?? 100) / 2) + 16}
							{@const ty = ht.y - 30}
							<g style="pointer-events: none">
								<rect x={tx} y={ty} width="220" height="76" rx="6" fill="var(--fr-surface)" stroke="var(--fr-border-strong)" stroke-width="1" />
								<text x={tx + 12} y={ty + 22} font-size="13" font-weight="600" fill="var(--fr-text)">{ht.res.guest}</text>
								<text x={tx + 12} y={ty + 40} font-size="11" fill="var(--fr-text-muted)">Party {ht.res.party} · {ht.res.time}</text>
								{#if ht.res.note}
									<text x={tx + 12} y={ty + 60} font-size="10.5" fill="var(--fr-text-muted)" font-style="italic">"{ht.res.note.slice(0, 30)}{ht.res.note.length > 30 ? '...' : ''}"</text>
								{/if}
							</g>
						{/if}
					{/if}
				</svg>
			</div>
		</div>

		<!-- Floating right rail -->
		<aside style="position: absolute; top: 3.75rem; right: 0.75rem; max-height: calc(100% - 4.5rem); width: 20rem; z-index: 10; overflow: auto; display: flex; flex-direction: column; background: color-mix(in oklch, var(--fr-surface) 92%, transparent); backdrop-filter: blur(12px); border: 1px solid var(--fr-border); border-radius: var(--fr-radius); box-shadow: var(--fr-shadow-md)">
			{#if mode === 'edit' && selected}
				<!-- Editor Panel -->
				{@const sel = getSelectedItem()}
				{#if sel?.kind === 'vertex' && sel.item}
					{@const wallId = selected.id.split('::')[0]}
					{@const idx = sel.idx ?? 0}
					{@const wall = sel.item as Wall}
					{@const p = wall.points[idx]}
					{@const prev = wall.points[idx === 0 ? (wall.closed ? wall.points.length - 1 : -1) : idx - 1]}
					{@const next = wall.points[idx === wall.points.length - 1 ? (wall.closed ? 0 : -1) : idx + 1]}
					{@const segIn = prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0}
					{@const segOut = next ? Math.hypot(p.x - next.x, p.y - next.y) : 0}
					<div class="fr-card-head">
						<div>
							<div class="fr-card-title">Wall vertex</div>
							<div class="fr-card-sub">{wallId} · point {idx + 1} / {wall.points.length}</div>
						</div>
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={(e) => { e.stopPropagation(); selected = null; }}><X size={13} /></button>
					</div>
					<div style="padding: 16px; display: flex; flex-direction: column; gap: 14px">
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
							<div>
								<div class="fr-label">X</div>
								<input class="fr-input" type="number" value={Math.round(p.x)} oninput={(e) => updateWallPoint(wallId, idx, { x: +(e.target as HTMLInputElement).value })} />
							</div>
							<div>
								<div class="fr-label">Y</div>
								<input class="fr-input" type="number" value={Math.round(p.y)} oninput={(e) => updateWallPoint(wallId, idx, { y: +(e.target as HTMLInputElement).value })} />
							</div>
						</div>
						{#if prev}
							<div>
								<div class="fr-label">Distance to previous</div>
								<div class="fr-num" style="font-size: 14px; font-weight: 600">{fmtLen(segIn, units)}</div>
							</div>
						{/if}
						{#if next}
							<div>
								<div class="fr-label">Distance to next</div>
								<div class="fr-num" style="font-size: 14px; font-weight: 600">{fmtLen(segOut, units)}</div>
							</div>
						{/if}
						<p class="fr-subtle" style="font-size: 11.5px; line-height: 1.5; margin: 0">Drag the square handle on the canvas, or use arrow keys (5cm steps, Shift for 20cm).</p>
						<button class="fr-btn" style="color: var(--fr-danger)" onclick={(e) => { e.stopPropagation(); deleteSelected(); }} disabled={wall.points.length <= 2}><Trash2 size={13} /> Remove vertex</button>
					</div>

				{:else if sel?.kind === 'segment' && sel.item}
					{@const wall = sel.item as Wall}
					{@const segIdx = sel.idx ?? 0}
					{@const a = wall.points[segIdx]}
					{@const b = wall.points[(segIdx + 1) % wall.points.length]}
					{@const segLen = Math.hypot(b.x - a.x, b.y - a.y)}
					{@const segAngle = Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI)}
					<div class="fr-card-head">
						<div>
							<div class="fr-card-title">Wall segment</div>
							<div class="fr-card-sub">{fmtLen(segLen, units)} · {segAngle}&deg;</div>
						</div>
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={(e) => { e.stopPropagation(); selected = null; }}><X size={13} /></button>
					</div>
					<div style="padding: 1rem; display: flex; flex-direction: column; gap: 0.875rem">
						<p class="fr-subtle" style="font-size: 0.72rem; line-height: 1.5; margin: 0">Drag to move this segment. Click vertex handles to edit points.</p>
						<button class="fr-btn fr-btn-sm" onclick={() => { selected = { kind: 'wall', id: wall.id }; }}>Select entire wall</button>
						<button class="fr-btn fr-btn-sm" style="color: var(--fr-danger)" onclick={(e) => { e.stopPropagation(); deleteSelected(); }}><Trash2 size={13} /> Delete segment</button>
					</div>

				{:else if sel?.kind === 'wall' && sel.item}
					{@const wall = sel.item as Wall}
					{@const total = (() => { let t2 = 0; for (let i = 0; i < wall.points.length - 1; i++) t2 += Math.hypot(wall.points[i+1].x - wall.points[i].x, wall.points[i+1].y - wall.points[i].y); if (wall.closed) t2 += Math.hypot(wall.points[0].x - wall.points[wall.points.length-1].x, wall.points[0].y - wall.points[wall.points.length-1].y); return t2; })()}
					<div class="fr-card-head">
						<div>
							<div class="fr-card-title">Wall</div>
							<div class="fr-card-sub">{wall.points.length} vertices · {fmtLen(total, units)} total</div>
						</div>
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={(e) => { e.stopPropagation(); selected = null; }}><X size={13} /></button>
					</div>
					<div style="padding: 16px; display: flex; flex-direction: column; gap: 14px">
						<div>
							<div class="fr-label" style="display: flex; justify-content: space-between"><span>Thickness</span><strong>{wall.thickness}px</strong></div>
							<input type="range" min={2} max={14} step={1} value={wall.thickness} oninput={(e) => updateWall(selected!.id, { thickness: +(e.target as HTMLInputElement).value })} style="width: 100%" />
						</div>
						<p class="fr-subtle" style="font-size: 11.5px; line-height: 1.5; margin: 0">Drag any square handle to reshape. Double-click a midpoint (dashed circle) to add a vertex. Select a vertex and press Delete to remove it.</p>
						<button class="fr-btn" style="color: var(--fr-danger)" onclick={(e) => { e.stopPropagation(); deleteSelected(); }}><Trash2 size={13} /> Delete wall</button>
					</div>

				{:else if sel?.kind === 'table' && sel.item}
					{@const item = sel.item as FloorTable}
					<div class="fr-card-head">
						<div>
							<div class="fr-card-title">{item.id}</div>
							<div class="fr-card-sub">{item.area} · {item.shape} · {Math.round(item.rot || 0)}&deg;</div>
						</div>
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={(e) => { e.stopPropagation(); selected = null; }}><X size={13} /></button>
					</div>
					<div style="padding: 16px; display: flex; flex-direction: column; gap: 14px">
						{#if collisions.has(item.id)}
							<div style="padding: 10px 12px; background: color-mix(in oklch, var(--fr-danger) 10%, var(--fr-surface)); border: 1px solid color-mix(in oklch, var(--fr-danger) 40%, var(--fr-border)); border-radius: var(--fr-radius-sm); font-size: 12px; color: var(--fr-danger); display: flex; align-items: flex-start; gap: 8px">
								<Zap size={13} /><span>Not enough clearance — overlapping a neighbour, wall, or door swing.</span>
							</div>
						{/if}
						<div>
							<div class="fr-label">ID</div>
							<input class="fr-input" value={item.id} oninput={(e) => updateTable(item.id, { id: (e.target as HTMLInputElement).value })} />
						</div>
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
							<div>
								<div class="fr-label">Shape</div>
								<div class="fr-segment" style="width: 100%">
									<button class:active={item.shape === 'round'} onclick={() => updateTable(item.id, { shape: 'round', d: item.d || 80 })} style="flex: 1">Round</button>
									<button class:active={item.shape === 'rect'} onclick={() => updateTable(item.id, { shape: 'rect', w: item.w || 100, h: item.h || 80 })} style="flex: 1">Rect</button>
								</div>
							</div>
							<div>
								<div class="fr-label">Area</div>
								<select class="fr-select" value={item.area} onchange={(e) => updateTable(item.id, { area: (e.target as HTMLSelectElement).value })}>
									{#each ['Main', 'Bar', 'Garden', 'Private'] as areaName (areaName)}
										<option>{areaName}</option>
									{/each}
								</select>
							</div>
						</div>
						<div>
							<div class="fr-label" style="display: flex; justify-content: space-between"><span>Seats</span><strong>{item.seats}</strong></div>
							<input type="range" min={1} max={14} value={item.seats} oninput={(e) => updateTable(item.id, { seats: +(e.target as HTMLInputElement).value })} style="width: 100%" />
						</div>
						{#if item.shape === 'round'}
							<div>
								<div class="fr-label" style="display: flex; justify-content: space-between"><span>Diameter</span><strong>{fmtLen(item.d ?? 80, units)}</strong></div>
								<input type="range" min={60} max={200} step={5} value={item.d ?? 80} oninput={(e) => updateTable(item.id, { d: +(e.target as HTMLInputElement).value })} style="width: 100%" />
							</div>
						{:else}
							<div>
								<div class="fr-label" style="display: flex; justify-content: space-between"><span>Width</span><strong>{fmtLen(item.w ?? 100, units)}</strong></div>
								<input type="range" min={60} max={300} step={5} value={item.w ?? 100} oninput={(e) => updateTable(item.id, { w: +(e.target as HTMLInputElement).value })} style="width: 100%" />
							</div>
							<div>
								<div class="fr-label" style="display: flex; justify-content: space-between"><span>Depth</span><strong>{fmtLen(item.h ?? 80, units)}</strong></div>
								<input type="range" min={60} max={200} step={5} value={item.h ?? 80} oninput={(e) => updateTable(item.id, { h: +(e.target as HTMLInputElement).value })} style="width: 100%" />
							</div>
						{/if}
						<div>
							<div class="fr-label" style="display: flex; justify-content: space-between"><span>Rotation</span><strong>{Math.round(item.rot || 0)}&deg;</strong></div>
							<input type="range" min={-180} max={180} step={5} value={item.rot || 0} oninput={(e) => updateTable(item.id, { rot: +(e.target as HTMLInputElement).value })} style="width: 100%" />
							<div class="fr-row" style="gap: 4px; margin-top: 6px">
								{#each [0, 45, 90, 135, 180, -45, -90, -135] as deg (deg)}
									<button class="fr-btn fr-btn-sm {(item.rot || 0) === deg ? 'fr-btn-primary' : ''}" onclick={() => updateTable(item.id, { rot: deg })} style="flex: 1; padding: 0; font-size: 11px">{deg}&deg;</button>
								{/each}
							</div>
						</div>
						<div>
							<div class="fr-label">Status</div>
							<select class="fr-select" value={item.status} onchange={(e) => updateTable(item.id, { status: (e.target as HTMLSelectElement).value as TableStatus })}>
								{#each Object.keys(STATUS_THEME) as k (k)}
									<option value={k}>{k}</option>
								{/each}
							</select>
						</div>
						<button class="fr-btn" style="color: var(--fr-danger)" onclick={(e) => { e.stopPropagation(); deleteSelected(); }}><Trash2 size={13} /> Delete</button>
					</div>

				{:else if sel?.kind === 'door' && sel.item}
					{@const item = sel.item as Door}
					<div class="fr-card-head">
						<div>
							<div class="fr-card-title">Door</div>
							<div class="fr-card-sub">on {item.wallId} · swings {item.swing} · {item.hinge} hinge</div>
						</div>
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={(e) => { e.stopPropagation(); selected = null; }}><X size={13} /></button>
					</div>
					<div style="padding: 16px; display: flex; flex-direction: column; gap: 14px">
						<div>
							<div class="fr-label">Label</div>
							<input class="fr-input" value={item.label} oninput={(e) => updateDoor(item.id, { label: (e.target as HTMLInputElement).value })} placeholder="e.g. Kitchen, Restroom" />
						</div>
						<div>
							<div class="fr-label" style="display: flex; justify-content: space-between"><span>Width</span><strong>{fmtLen(item.width, units)}</strong></div>
							<input type="range" min={60} max={180} step={5} value={item.width} oninput={(e) => updateDoor(item.id, { width: +(e.target as HTMLInputElement).value })} style="width: 100%" />
						</div>
						<div>
							<div class="fr-label">Hinge side</div>
							<div class="fr-segment" style="width: 100%">
								<button class:active={item.hinge === 'left'} onclick={() => updateDoor(item.id, { hinge: 'left' })} style="flex: 1">Left</button>
								<button class:active={item.hinge === 'right'} onclick={() => updateDoor(item.id, { hinge: 'right' })} style="flex: 1">Right</button>
							</div>
						</div>
						<div>
							<div class="fr-label">Swing</div>
							<div class="fr-segment" style="width: 100%">
								<button class:active={item.swing === 'in'} onclick={() => updateDoor(item.id, { swing: 'in' })} style="flex: 1">Inward</button>
								<button class:active={item.swing === 'out'} onclick={() => updateDoor(item.id, { swing: 'out' })} style="flex: 1">Outward</button>
							</div>
						</div>
						<div>
							<div class="fr-label" style="display: flex; justify-content: space-between"><span>Open angle (visualised)</span><strong>{item.open}&deg;</strong></div>
							<input type="range" min={30} max={120} step={5} value={item.open} oninput={(e) => updateDoor(item.id, { open: +(e.target as HTMLInputElement).value })} style="width: 100%" />
						</div>
						<p class="fr-subtle" style="font-size: 11.5px; line-height: 1.5; margin: 0">Drag the door along its wall on the canvas. Tables inside the swing arc trigger a clearance warning.</p>
						<button class="fr-btn" style="color: var(--fr-danger)" onclick={(e) => { e.stopPropagation(); deleteSelected(); }}><Trash2 size={13} /> Delete door</button>
					</div>

				{:else if sel?.kind === 'fixture' && sel.item}
					{@const item = sel.item as Fixture}
					<div class="fr-card-head">
						<div>
							<div class="fr-card-title">Fixture</div>
							<div class="fr-card-sub">{item.kind} · {fmtLen(item.w, units)} x {fmtLen(item.h, units)}</div>
						</div>
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={(e) => { e.stopPropagation(); selected = null; }}><X size={13} /></button>
					</div>
					<div style="padding: 16px; display: flex; flex-direction: column; gap: 14px">
						<div>
							<div class="fr-label">Label</div>
							<input class="fr-input" value={item.label} oninput={(e) => updateFixture(item.id, { label: (e.target as HTMLInputElement).value })} />
						</div>
						<div>
							<div class="fr-label">Type</div>
							<select class="fr-select" value={item.kind} onchange={(e) => updateFixture(item.id, { kind: (e.target as HTMLSelectElement).value as Fixture['kind'] })}>
								{#each [['host', 'Host stand'], ['bar', 'Bar'], ['banq', 'Banquette'], ['planter', 'Planter'], ['fire', 'Fireplace'], ['kitchen', 'Service station'], ['restroom', 'Restroom']] as [v, l] (v)}
									<option value={v}>{l}</option>
								{/each}
							</select>
						</div>
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
							<div>
								<div class="fr-label">Width</div>
								<input class="fr-input" type="number" value={item.w} oninput={(e) => updateFixture(item.id, { w: +(e.target as HTMLInputElement).value })} />
							</div>
							<div>
								<div class="fr-label">Depth</div>
								<input class="fr-input" type="number" value={item.h} oninput={(e) => updateFixture(item.id, { h: +(e.target as HTMLInputElement).value })} />
							</div>
						</div>
						<button class="fr-btn" style="color: var(--fr-danger)" onclick={(e) => { e.stopPropagation(); deleteSelected(); }}><Trash2 size={13} /> Delete</button>
					</div>

				{:else if sel?.kind === 'area' && sel.item}
					{@const item = sel.item as FloorArea}
					<div class="fr-card-head">
						<div>
							<div class="fr-card-title">Area</div>
							<div class="fr-card-sub">{item.name}</div>
						</div>
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={(e) => { e.stopPropagation(); selected = null; }}><X size={13} /></button>
					</div>
					<div style="padding: 16px; display: flex; flex-direction: column; gap: 14px">
						<div>
							<div class="fr-label">Name</div>
							<input class="fr-input" value={item.name} oninput={(e) => updateArea(item.id, { name: (e.target as HTMLInputElement).value })} />
						</div>
						<div>
							<div class="fr-label">Tint</div>
							<select class="fr-select" value={item.tint} onchange={(e) => updateArea(item.id, { tint: (e.target as HTMLSelectElement).value as AreaTint })}>
								{#each ['main', 'bar', 'garden', 'priv'] as t (t)}
									<option value={t}>{t}</option>
								{/each}
							</select>
						</div>
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
							<div>
								<div class="fr-label">Width</div>
								<input class="fr-input" type="number" value={item.w} oninput={(e) => updateArea(item.id, { w: +(e.target as HTMLInputElement).value })} />
							</div>
							<div>
								<div class="fr-label">Height</div>
								<input class="fr-input" type="number" value={item.h} oninput={(e) => updateArea(item.id, { h: +(e.target as HTMLInputElement).value })} />
							</div>
						</div>
						<button class="fr-btn" style="color: var(--fr-danger)" onclick={(e) => { e.stopPropagation(); deleteSelected(); }}><Trash2 size={13} /> Delete area</button>
					</div>
				{/if}

			{:else if mode === 'edit'}
				<!-- Add Panel -->
				<div class="fr-card-head"><div class="fr-card-title">Add to layout</div></div>
				<div style="padding: 16px; display: flex; flex-direction: column; gap: 12px">
					<p class="fr-subtle" style="font-size: 12px; line-height: 1.5; margin: 0">Click a wall to select it and reveal vertex handles. Drag walls to move. Double-click a midpoint to add a vertex. Select a vertex and press Delete to remove it.</p>
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
						{#each [
							{ l: '2-top', shape: 'round' as const, seats: 2, d: 70 },
							{ l: '2-top sq', shape: 'rect' as const, seats: 2, w: 80, h: 80 },
							{ l: '4-top', shape: 'rect' as const, seats: 4, w: 120, h: 90 },
							{ l: '6-top', shape: 'rect' as const, seats: 6, w: 180, h: 90 },
							{ l: '8-top', shape: 'rect' as const, seats: 8, w: 220, h: 100 },
							{ l: 'Round 4', shape: 'round' as const, seats: 4, d: 100 }
						] as tmpl, i (i)}
							<button class="fr-btn" style="height: 60px; flex-direction: column; gap: 4px; padding: 8px" onclick={() => addTable(tmpl)}>
								<div style="display: flex; align-items: center; gap: 6px">
									<span style="width: 20px; height: 14px; background: var(--fr-surface-muted); border: 1.5px solid var(--fr-border-strong); border-radius: {tmpl.shape === 'round' ? '999px' : '3px'}"></span>
									<span style="font-size: 12px">{tmpl.l}</span>
								</div>
								<span class="fr-subtle" style="font-size: 10px">{tmpl.seats} seats</span>
							</button>
						{/each}
					</div>
					{#if collisions.size > 0}
						<div style="border-top: 1px solid var(--fr-border); padding-top: 12px">
							<div class="fr-label" style="display: flex; align-items: center; gap: 6px; color: var(--fr-danger)"><Zap size={12} /> {collisions.size} spacing issue{collisions.size > 1 ? 's' : ''}</div>
							<div style="display: flex; flex-direction: column; gap: 4px">
								{#each Array.from(collisions) as cid (cid)}
									<button class="fr-btn fr-btn-sm" onclick={() => { selected = { kind: 'table', id: cid }; }} style="justify-content: flex-start; font-family: var(--fr-font-mono); font-size: 11.5px">
										<span style="width: 6px; height: 6px; border-radius: 999px; background: var(--fr-danger)"></span> {cid}
									</button>
								{/each}
							</div>
						</div>
					{/if}
					<div style="border-top: 1px solid var(--fr-border); padding-top: 10px">
						<div class="fr-label">Active tool: <strong style="color: var(--fr-text); text-transform: capitalize">{tool}</strong></div>
						<p class="fr-subtle" style="font-size: 11.5px; line-height: 1.5; margin: 0">
							{#if tool === 'select'}Click anything to select. Walls show vertex handles; drag those to reshape.
							{:else if tool === 'wall'}Click points; angles snap to 0/45/90 deg. Hold Shift to draw freely. Enter finishes; Esc cancels.
							{:else if tool === 'door'}Click on any wall to drop a door at that point. Then drag along the wall to position.
							{:else if tool === 'fixture'}Click on the canvas to drop a fixture (host stand, bar, etc.).
							{:else if tool === 'area'}Click and drag to draw a labeled zone (e.g. Lounge, Patio).
							{/if}
						</p>
					</div>
				</div>

			{:else if editingSections}
				<!-- Section management panel -->
				<div class="fr-card-head">
					<div class="fr-card-title">Server sections</div>
					<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => { editingSections = false; editSectionId = null; }}><X size={13} /></button>
				</div>
				<div style="padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem">
					{#if editSectionId}
						<div class="fr-label">Section name</div>
						<input class="fr-input" bind:value={newSectionName} placeholder="e.g. Section A" />
						<div class="fr-label">Server</div>
						<select class="fr-select" bind:value={newSectionStaffId}>
							<option value="">Select server...</option>
							{#each (data.servers ?? []) as s (s.staffId)}
								<option value={s.staffId}>{s.name ?? 'Unknown'}</option>
							{/each}
						</select>
						<div class="fr-label">Color</div>
						<div style="display: flex; gap: 0.375rem; flex-wrap: wrap">
							{#each SECTION_COLORS as c (c)}
								<button
									style="width: 1.5rem; height: 1.5rem; border-radius: 4px; background: {c}; border: 2px solid {newSectionColor === c ? 'var(--fr-text)' : 'transparent'}; cursor: pointer"
									onclick={() => newSectionColor = c}
								></button>
							{/each}
						</div>
						<div class="fr-label">Tables ({newSectionTableIds.length} selected)</div>
						<p class="fr-subtle" style="font-size: 0.72rem; margin: 0">Click tables on the floor plan to assign them.</p>
						<div style="display: flex; gap: 0.375rem">
							<button class="fr-btn fr-btn-primary fr-btn-sm" style="flex: 1" disabled={!newSectionName || !newSectionStaffId} onclick={async () => {
								const fd = new FormData();
								fd.set('name', newSectionName);
								fd.set('staffId', newSectionStaffId);
								fd.set('color', newSectionColor);
								fd.set('date', new Date().toISOString().slice(0, 10));
								fd.set('tableIds', JSON.stringify(newSectionTableIds));
								if (editSectionId === 'new') {
									await fetch('/dashboard/floor?/createSection', { method: 'POST', body: fd });
								} else {
									fd.set('sectionId', editSectionId!);
									await fetch('/dashboard/floor?/updateSection', { method: 'POST', body: fd });
								}
								const { invalidateAll } = await import('$app/navigation');
								await invalidateAll();
								editSectionId = null;
								newSectionName = '';
								newSectionStaffId = '';
								newSectionTableIds = [];
							}}><Check size={13} /> {editSectionId === 'new' ? 'Create' : 'Save'}</button>
							<button class="fr-btn fr-btn-sm" onclick={() => { editSectionId = null; newSectionTableIds = []; }}>Cancel</button>
						</div>
					{:else}
						<button class="fr-btn fr-btn-sm fr-btn-primary" onclick={() => { editSectionId = 'new'; newSectionName = ''; newSectionStaffId = ''; newSectionColor = SECTION_COLORS[((data.sections ?? []).length) % SECTION_COLORS.length]; newSectionTableIds = []; }}><Plus size={13} /> New section</button>
						{#each (data.sections ?? []) as section (section.id)}
							<div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border: 1px solid var(--fr-border); border-radius: var(--fr-radius-sm)">
								<div style="width: 1rem; height: 1rem; background: {section.color}; border-radius: 3px; flex-shrink: 0"></div>
								<div style="flex: 1; min-width: 0">
									<div style="font-weight: 500; font-size: 0.8125rem">{section.name}</div>
									<div class="fr-subtle" style="font-size: 0.6875rem">{section.staffName} · {section.tableIds.length} tables</div>
								</div>
								<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => { editSectionId = section.id; newSectionName = section.name; newSectionStaffId = section.staffId; newSectionColor = section.color; newSectionTableIds = [...section.tableIds]; }} title="Edit"><Tag size={12} /></button>
								<button class="fr-btn fr-btn-sm fr-btn-ghost" style="color: var(--fr-danger)" onclick={async () => {
									if (!confirm(`Delete "${section.name}"?`)) return;
									const fd = new FormData();
									fd.set('sectionId', section.id);
									await fetch('/dashboard/floor?/deleteSection', { method: 'POST', body: fd });
									const { invalidateAll } = await import('$app/navigation');
									await invalidateAll();
								}} title="Delete"><Trash2 size={12} /></button>
							</div>
						{/each}
						{#if (data.sections ?? []).length === 0}
							<p class="fr-subtle" style="font-size: 0.75rem; margin: 0">No sections for today. Create one to assign servers to tables.</p>
						{/if}
					{/if}
				</div>

			{:else if serviceTable}
				<!-- Selected table panel -->
				{@const st = serviceTable}
				{@const theme = STATUS_THEME[st.status]}
				<div class="fr-card-head">
					<div>
						<div class="fr-card-title">{st.id}</div>
						<div class="fr-card-sub">{st.area} · {st.seats} seats · {st.shape}</div>
					</div>
					<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => serviceTableId = null}><X size={13} /></button>
				</div>
				<div style="padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem">
					<div style="display: flex; align-items: center; gap: 0.5rem">
						<div style="width: 1rem; height: 1rem; background: {theme.fill}; border: 1.5px solid {theme.stroke}; border-radius: 3px; flex-shrink: 0"></div>
						<span style="text-transform: capitalize; font-size: 0.8125rem; font-weight: 500">{st.status.replace('-', ' ')}</span>
					</div>

					{#if st.section}
					<div style="display: flex; align-items: center; gap: 0.5rem">
						<div style="width: 1rem; height: 1rem; background: {st.section.color}; border-radius: 3px; flex-shrink: 0"></div>
						<span style="font-size: 0.8125rem">{st.section.name} — <strong>{st.section.staffName}</strong></span>
					</div>
					{/if}

					{#if st.res}
						<div style="border-top: 1px solid var(--fr-border); padding-top: 0.75rem">
							<div class="fr-label" style="margin-bottom: 0.375rem">Current reservation</div>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								style="padding: 0.75rem; background: var(--fr-surface-muted); border-radius: var(--fr-radius-sm); cursor: pointer; transition: background 0.1s"
								onclick={() => { openRes = st.res!; }}
								onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--fr-border)'; }}
								onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--fr-surface-muted)'; }}
							>
								<div style="font-weight: 600; font-size: 0.8125rem">{st.res.guest}</div>
								<div class="fr-subtle" style="font-size: 0.75rem; margin-top: 0.25rem">Party of {st.res.party} · {st.res.time}</div>
								{#if st.res.note}
									<div style="font-size: 0.72rem; color: var(--fr-text-muted); margin-top: 0.375rem; font-style: italic">"{st.res.note.slice(0, 60)}{st.res.note.length > 60 ? '...' : ''}"</div>
								{/if}
								{#if st.res.tags.length > 0}
									<div style="display: flex; gap: 0.25rem; margin-top: 0.375rem; flex-wrap: wrap">
										{#each st.res.tags as tag (tag)}
											<span class="fr-tag" style="font-size: 0.625rem">{tag}</span>
										{/each}
									</div>
								{/if}
							</div>
							<div style="margin-top: 0.5rem; font-size: 0.72rem; color: var(--fr-text-muted)">Tap for full details</div>
						</div>

						<div style="display: flex; gap: 0.375rem">
							{#if st.res.status === 'confirmed'}
								<button class="fr-btn fr-btn-primary fr-btn-sm" style="flex: 1" onclick={async () => {
									const fd = new FormData();
									fd.set('reservationId', st.res!.id);
									fd.set('state', 'Seated');
									await fetch('/dashboard/reservations?/updateStatus', { method: 'POST', body: fd });
									const { invalidateAll } = await import('$app/navigation');
									await invalidateAll();
								}}><Check size={13} /> Seat</button>
							{/if}
							{#if st.res.status === 'seated'}
								<button class="fr-btn fr-btn-primary fr-btn-sm" style="flex: 1" onclick={async () => {
									const fd = new FormData();
									fd.set('reservationId', st.res!.id);
									fd.set('state', 'Completed');
									await fetch('/dashboard/reservations?/updateStatus', { method: 'POST', body: fd });
									const { invalidateAll } = await import('$app/navigation');
									await invalidateAll();
								}}><Check size={13} /> Complete</button>
							{/if}
						</div>
					{:else}
						<div style="border-top: 1px solid var(--fr-border); padding-top: 0.75rem">
							<div class="fr-subtle" style="font-size: 0.75rem">No reservation assigned to this table.</div>
						</div>
					{/if}

					<div style="border-top: 1px solid var(--fr-border); padding-top: 0.75rem; display: flex; gap: 0.375rem">
						{#if st.status === 'available'}
							<button class="fr-btn fr-btn-sm" style="flex: 1" onclick={async () => {
								const fd = new FormData();
								fd.set('tableNumber', st.id);
								await fetch('/dashboard/floor?/blockTable', { method: 'POST', body: fd });
								const { invalidateAll } = await import('$app/navigation');
								await invalidateAll();
							}}>Block table</button>
						{/if}
						{#if st.status === 'blocked'}
							<button class="fr-btn fr-btn-sm" style="flex: 1" onclick={async () => {
								const fd = new FormData();
								fd.set('tableNumber', st.id);
								await fetch('/dashboard/floor?/unblockTable', { method: 'POST', body: fd });
								const { invalidateAll } = await import('$app/navigation');
								await invalidateAll();
							}}>Unblock table</button>
						{/if}
						{#if st.status === 'dirty'}
							<button class="fr-btn fr-btn-sm fr-btn-primary" style="flex: 1" onclick={async () => {
								const fd = new FormData();
								fd.set('tableNumber', st.id);
								await fetch('/dashboard/floor?/unblockTable', { method: 'POST', body: fd });
								const { invalidateAll } = await import('$app/navigation');
								await invalidateAll();
							}}>Mark clean</button>
						{/if}
					</div>
				</div>

			{:else}
				<!-- Service Panel -->
				<div class="fr-card-head"><div class="fr-card-title">Status</div></div>
				<div style="padding: 14px; display: flex; flex-direction: column; gap: 8px; font-size: 12.5px">
					{#each Object.entries(counts) as [k, n] (k)}
						{@const s = STATUS_THEME[k as TableStatus]}
						<div style="display: flex; align-items: center; gap: 10px">
							<div style="width: 18px; height: 18px; background: {s.fill}; border: 1.5px solid {s.stroke}; border-radius: 4px; flex-shrink: 0"></div>
							<div style="text-transform: capitalize">{k.replace('-', ' ')}</div>
							<div class="fr-subtle fr-num" style="margin-left: auto">{n}</div>
						</div>
					{/each}
					<div style="display: flex; justify-content: space-between; border-top: 1px solid var(--fr-border); padding-top: 10px; margin-top: 4px; font-size: 12px">
						<span class="fr-muted">Capacity</span>
						<span class="fr-num"><strong>{occupiedSeats}</strong> / {totalSeats} seats</span>
					</div>
				</div>
				<div class="fr-card-head" style="border-top: 1px solid var(--fr-border)">
					<div class="fr-card-title">Coming up</div>
					<span class="fr-subtle" style="font-size: 11px">next 90 min</span>
				</div>
				<div style="padding: 4px">
					{#each confirmedReservations as r (r.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							style="padding: 10px 14px; cursor: pointer; border-radius: 6px; transition: background 0.1s"
							onclick={() => { openRes = r; }}
							onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--fr-surface-muted)'; }}
							onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
						>
							<div style="display: flex; justify-content: space-between; align-items: center">
								<span class="fr-num" style="font-weight: 600; font-size: 13px">{r.time}</span>
								<span class="fr-tag">{r.table}</span>
							</div>
							<div style="font-size: 12.5px; margin-top: 3px">{r.guest}</div>
							<div class="fr-subtle" style="font-size: 11px">Party of {r.party}{r.tags.length ? ` · ${r.tags[0]}` : ''}</div>
						</div>
					{/each}
				</div>
				{#if (data.sections ?? []).length > 0}
					<div class="fr-card-head" style="border-top: 1px solid var(--fr-border)">
						<div class="fr-card-title">Sections</div>
					</div>
					<div style="padding: 0.875rem; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem">
						{#each data.sections as section (section.id)}
							<div style="display: flex; align-items: center; gap: 0.625rem">
								<div style="width: 1rem; height: 1rem; background: {section.color}; border-radius: 3px; flex-shrink: 0; opacity: 0.8"></div>
								<div style="flex: 1; min-width: 0">
									<div style="font-weight: 500">{section.name}</div>
									<div class="fr-subtle" style="font-size: 0.6875rem">{section.staffName} · {section.tableIds.length} tables</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</aside>
</div>

{#if openRes}
	<ReservationDrawer res={openRes} onclose={() => { openRes = null; }} servers={data.servers ?? []} />
{/if}

{#if showLayoutMenu}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div style="position: fixed; inset: 0; z-index: 50" onclick={() => showLayoutMenu = false}>
		<div style="position: fixed; left: {layoutMenuPos.x}px; top: {layoutMenuPos.y}px; width: 14rem; background: var(--fr-surface); border: 1px solid var(--fr-border); border-radius: var(--fr-radius); box-shadow: var(--fr-shadow-lg); overflow: hidden" onclick={(e) => e.stopPropagation()}>
			{#each (data.layouts ?? []) as layout (layout.id)}
				<button
					style="display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.5rem 0.75rem; border: 0; background: {data.activeLayoutId === layout.id ? 'var(--fr-surface-muted)' : 'transparent'}; cursor: pointer; font-size: 0.8125rem; text-align: left; font-family: inherit; color: var(--fr-text)"
					onclick={async () => {
						const fd = new FormData();
						fd.set('layoutId', layout.id);
						await fetch('/dashboard/floor?/switchLayout', { method: 'POST', body: fd });
						const { invalidateAll, goto } = await import('$app/navigation');
						await invalidateAll();
						showLayoutMenu = false;
						await goto('/dashboard/floor', { invalidateAll: true });
						requestAnimationFrame(() => fitToContent());
					}}
				>
					{#if data.activeLayoutId === layout.id}<Check size={12} />{/if}
					<span style="flex: 1">{layout.name}</span>
					{#if layout.isDefault}<span class="fr-subtle" style="font-size: 0.6875rem">default</span>{/if}
				</button>
			{/each}
			<div style="border-top: 1px solid var(--fr-border); padding: 0.375rem">
				<button class="fr-btn fr-btn-sm fr-btn-ghost" style="width: 100%; justify-content: center" onclick={() => { showSaveAsDialog = true; showLayoutMenu = false; }}><Plus size={12} /> Save as new layout</button>
			</div>
		</div>
	</div>
{/if}

{#if showSaveAsDialog}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fr-modal-overlay" onclick={() => showSaveAsDialog = false}>
		<div class="fr-modal" style="width: 24rem" onclick={(e) => e.stopPropagation()}>
			<div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--fr-border)">
				<h2 style="margin: 0; font-size: 1.125rem; font-weight: 600">Save layout as</h2>
				<p class="fr-subtle" style="margin-top: 0.25rem; font-size: 0.8125rem">Save the current table arrangement as a named preset you can switch to later.</p>
			</div>
			<div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem">
				<div>
					<label class="fr-label" for="layout-name">Layout name</label>
					<input class="fr-input" id="layout-name" type="text" bind:value={saveAsName} placeholder="e.g. Live Music, Brunch, Private Event" />
				</div>
			</div>
			<div style="padding: 1rem 1.5rem; border-top: 1px solid var(--fr-border); display: flex; justify-content: flex-end; gap: 0.5rem">
				<button class="fr-btn" onclick={() => { showSaveAsDialog = false; saveAsName = ''; }}>Cancel</button>
				<button class="fr-btn fr-btn-primary" disabled={!saveAsName.trim()} onclick={async () => {
					const layout = {
						floors,
						tables: tables.map(t => ({
							id: t.id, area: t.area, floorId: t.floorId, shape: t.shape, x: t.x, y: t.y,
							d: t.d, w: t.w, h: t.h, rot: t.rot, seats: t.seats, status: t.status
						})),
					};
					const fd = new FormData();
					fd.set('name', saveAsName.trim());
					fd.set('layout', JSON.stringify(layout));
					await fetch('/dashboard/floor?/saveLayoutAs', { method: 'POST', body: fd });
					const { invalidateAll } = await import('$app/navigation');
					await invalidateAll();
					showSaveAsDialog = false;
					saveAsName = '';
				}}><Check size={14} /> Save</button>
			</div>
		</div>
	</div>
{/if}
