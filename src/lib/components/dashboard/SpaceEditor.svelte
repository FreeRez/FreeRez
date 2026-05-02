<script lang="ts">
	import { untrack } from 'svelte';
	import { MousePointer, PenTool, DoorOpen, Briefcase, Square, Trash2, X, Check, Plus } from 'lucide-svelte';
	import type {
		Floor,
		FloorTable,
		Wall,
		Door,
		Fixture,
		FloorArea,
		Point,
		AreaTint
	} from '$lib/stores/floorplan-data';

	let {
		floors: initFloors,
		tables: initTables,
		onsave
	}: {
		floors: Floor[];
		tables: FloorTable[];
		onsave: (floors: Floor[], tables: FloorTable[]) => void;
	} = $props();

	// ─── Constants ──────────────────────────────────────────────────────────
	const GRID_MINOR_CM = 10;
	const GRID_CM = 50;
	const SNAP_CM = 5;
	const SNAP_ENDPOINT_CM = 25;
	const SNAP_ANGLE_DEG = 5;

	// ─── Floor state ────────────────────────────────────────────────────────
	// Clone props once for local editing. untrack() suppresses the
	// "only captures initial value" warning — we intentionally snapshot once.
	let activeFloorId = $state(untrack(() => initFloors[0]?.id ?? ''));
	let editFloors = $state<Floor[]>(untrack(() => {
		const cloned: Floor[] = JSON.parse(JSON.stringify(initFloors));
		return cloned.map(f => ({ ...f, doors: migrateDoors(f.doors, f.walls) }));
	}));
	let editTables = $state<FloorTable[]>(untrack(() => JSON.parse(JSON.stringify(initTables))));

	const activeFloor = $derived(editFloors.find(f => f.id === activeFloorId) ?? editFloors[0]);
	const floorTables = $derived(editTables.filter(t => t.floorId === activeFloorId));

	// ─── Editor state ───────────────────────────────────────────────────────
	let tool = $state<'select' | 'wall' | 'door' | 'fixture' | 'area'>('select');
	let drawing = $state<{ kind: string; points?: Point[]; x1?: number; y1?: number; x2?: number; y2?: number } | null>(null);
	let mouseWorld = $state<Point | null>(null);
	let selected = $state<{ kind: string; id: string } | null>(null);
	let showGrid = $state(true);
	let showDims = $state(true);
	let spaceHeld = $state(false);
	let units = $state<'metric' | 'imperial'>('metric');
	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let svgRef = $state<SVGSVGElement | null>(null);
	let svgClientW = $state(800);
	let dragRef = $state<{
		kind: string;
		id?: string;
		dx?: number; dy?: number;
		wallId?: string; idx?: number;
		sx?: number; sy?: number;
		originalPoints?: Point[];
		startClientX?: number; startClientY?: number;
		startPanX?: number; startPanY?: number;
		origWallId?: string; origSegIndex?: number; origT?: number;
	} | null>(null);

	const DOOR_SNAP_THRESHOLD = 80;
	let doorDragPos = $state<{ x: number; y: number; angle: number } | null>(null);
	let doorSnapCandidate = $state<{ wallId: string; segIndex: number; t: number; x: number; y: number; angle: number } | null>(null);

	function findBestWallSnap(px: number, py: number): { wallId: string; segIndex: number; t: number; x: number; y: number; angle: number; dist: number } | null {
		let best: { wallId: string; segIndex: number; t: number; x: number; y: number; angle: number; dist: number } | null = null;
		for (const wall of activeFloor.walls) {
			const segCount = wall.closed ? wall.points.length : wall.points.length - 1;
			for (let i = 0; i < segCount; i++) {
				const a = wall.points[i], b = wall.points[(i + 1) % wall.points.length];
				const c = closestOnSeg(px, py, a.x, a.y, b.x, b.y);
				const d = Math.hypot(px - c.x, py - c.y);
				if (!best || d < best.dist) {
					const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
					best = { wallId: wall.id, segIndex: i, t: c.t, x: c.x, y: c.y, angle, dist: d };
				}
			}
		}
		return best;
	}

	// ─── Undo / Redo ────────────────────────────────────────────────────────
	type Snapshot = { floors: Floor[] };
	let undoStack: Snapshot[] = [];
	let redoStack: Snapshot[] = [];

	function takeSnapshot(): Snapshot {
		return { floors: JSON.parse(JSON.stringify($state.snapshot(editFloors))) };
	}
	function pushUndo() {
		undoStack.push(takeSnapshot());
		if (undoStack.length > 50) undoStack.shift();
		redoStack = [];
	}
	function undo() {
		if (!undoStack.length) return;
		redoStack.push(takeSnapshot());
		const snap = undoStack.pop()!;
		editFloors = snap.floors;
	}
	function redo() {
		if (!redoStack.length) return;
		undoStack.push(takeSnapshot());
		const snap = redoStack.pop()!;
		editFloors = snap.floors;
	}

	// ─── Floor management ──────────────────────────────────────────────────
	let renamingFloorId = $state<string | null>(null);
	let renameValue = $state('');

	function addFloor() {
		pushUndo();
		const nextOrdinal = Math.max(...editFloors.map(f => f.ordinal)) + 1;
		const id = `floor-${Date.now().toString(36)}`;
		const newFloor: Floor = {
			id,
			name: `Floor ${nextOrdinal + 1}`,
			ordinal: nextOrdinal,
			walls: [],
			doors: [],
			fixtures: [],
			areas: [],
			world: { w: 1400, h: 900 },
		};
		editFloors = [...editFloors, newFloor];
		activeFloorId = id;
		selected = null;
		drawing = null;
		tool = 'select';
	}

	function startRenameFloor(floorId: string) {
		const f = editFloors.find(fl => fl.id === floorId);
		if (!f) return;
		renamingFloorId = floorId;
		renameValue = f.name;
	}

	function commitRenameFloor() {
		if (!renamingFloorId || !renameValue.trim()) { renamingFloorId = null; return; }
		pushUndo();
		editFloors = editFloors.map(f =>
			f.id === renamingFloorId ? { ...f, name: renameValue.trim() } : f
		);
		renamingFloorId = null;
	}

	function deleteFloor(floorId: string) {
		if (editFloors.length <= 1) return;
		pushUndo();
		editFloors = editFloors.filter(f => f.id !== floorId);
		editTables = editTables.filter(t => t.floorId !== floorId);
		if (activeFloorId === floorId) {
			activeFloorId = editFloors[0].id;
		}
		selected = null;
	}

	// ─── Geometry helpers ───────────────────────────────────────────────────
	function dist(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
	function snapToGrid(v: number, step = SNAP_CM): number { return Math.round(v / step) * step; }
	function snapAngle(deg: number): number {
		const targets = [0, 45, 90, 135, 180, -45, -90, -135, -180];
		let best = deg, bestDiff = Infinity;
		for (const t of targets) {
			const d = Math.abs(((deg - t + 180) % 360 + 360) % 360 - 180);
			if (d < bestDiff && d <= SNAP_ANGLE_DEG) { best = t; bestDiff = d; }
		}
		return best;
	}
	function snapVecAngle(ox: number, oy: number, x: number, y: number): Point {
		const dx = x - ox, dy = y - oy, len = Math.hypot(dx, dy);
		if (len < 1) return { x, y };
		const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
		const snapped = snapAngle(deg);
		if (snapped === deg) return { x, y };
		const r = (snapped * Math.PI) / 180;
		return { x: ox + Math.cos(r) * len, y: oy + Math.sin(r) * len };
	}

	function fmtLen(cm: number, sys: string): string {
		if (sys === 'imperial') {
			const inches = cm / 2.54;
			if (inches < 12) return `${Math.round(inches)}″`;
			const ft = Math.floor(inches / 12);
			const ins = Math.round(inches - ft * 12);
			return ins ? `${ft}′${ins}″` : `${ft}′`;
		}
		return `${(cm / 100).toFixed(2)}m`;
	}

	function closestOnSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): { x: number; y: number; t: number } {
		const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
		if (len2 === 0) return { x: x1, y: y1, t: 0 };
		const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
		return { x: x1 + t * dx, y: y1 + t * dy, t };
	}

	function computeSeats(t: FloorTable): Point[] {
		const seats: { lx: number; ly: number }[] = [];
		const N = t.seats;
		if (t.shape === 'round') {
			const radius = (t.d ?? 80) / 2 + 18;
			for (let i = 0; i < N; i++) {
				const a = (i / N) * Math.PI * 2 - Math.PI / 2;
				seats.push({ lx: Math.cos(a) * radius, ly: Math.sin(a) * radius });
			}
		} else {
			const w = t.w ?? 100, h = t.h ?? 80;
			const widthwise = w >= h;
			let top: number, bot: number, left: number, right: number;
			if (N <= 2) { top = 1; bot = 1; left = 0; right = 0; }
			else if (N <= 6) { top = Math.ceil(N / 2); bot = Math.floor(N / 2); left = 0; right = 0; }
			else { top = Math.ceil((N - 2) / 2); bot = Math.floor((N - 2) / 2); left = 1; right = 1; }
			if (!widthwise) { [top, left] = [left, top]; [bot, right] = [right, bot]; }
			const place = (n: number, x0: number, y0: number, ddx: number, ddy: number, len: number) => {
				for (let i = 0; i < n; i++) {
					const f = (i + 1) / (n + 1);
					seats.push({ lx: x0 + ddx * f * len, ly: y0 + ddy * f * len });
				}
			};
			const gap = 18;
			place(top, -w / 2, -h / 2 - gap, 1, 0, w);
			place(bot, -w / 2, h / 2 + gap, 1, 0, w);
			place(left, -w / 2 - gap, -h / 2, 0, 1, h);
			place(right, w / 2 + gap, -h / 2, 0, 1, h);
		}
		const rad = ((t.rot || 0) * Math.PI) / 180;
		const cos = Math.cos(rad), sin = Math.sin(rad);
		return seats.map(s => ({ x: t.x + s.lx * cos - s.ly * sin, y: t.y + s.lx * sin + s.ly * cos }));
	}

	// ─── Door geometry ──────────────────────────────────────────────────────
	function resolveDoorPos(door: Door, wallList: Wall[]): { x: number; y: number; angleDeg: number } {
		if (door.wallId == null) return { x: door.x || 0, y: door.y || 0, angleDeg: door.wallAngle || 0 };
		const wall = wallList.find(w => w.id === door.wallId);
		if (!wall) return { x: door.x || 0, y: door.y || 0, angleDeg: door.wallAngle || 0 };
		const seg = Math.min(door.segIndex || 0, wall.points.length - 2);
		const a = wall.points[seg], b = wall.points[seg + 1];
		if (!b) return { x: a.x, y: a.y, angleDeg: 0 };
		const t = Math.max(0, Math.min(1, door.t ?? 0.5));
		const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
		const angleDeg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
		return { x, y, angleDeg };
	}

	function computeDoorGeom(px: number, py: number, angleDeg: number, d: Door) {
		const wallRad = (angleDeg * Math.PI) / 180;
		const dirX = Math.cos(wallRad), dirY = Math.sin(wallRad);
		const hingeSign = d.hinge === 'left' ? 1 : -1;
		const openSign = d.swing === 'in' ? 1 : -1;
		const openRad = openSign * hingeSign * (d.open * Math.PI) / 180;
		const totalRad = wallRad + openRad;
		const panelEndX = px + Math.cos(totalRad) * d.width * hingeSign;
		const panelEndY = py + Math.sin(totalRad) * d.width * hingeSign;
		const closedEndX = px + dirX * d.width * hingeSign;
		const closedEndY = py + dirY * d.width * hingeSign;
		return { pos: { x: px, y: py, angleDeg }, openRad, panelEndX, panelEndY, closedEndX, closedEndY, dirY, hingeSign };
	}

	function getDoorGeometry(d: Door, wallList: Wall[]) {
		const pos = resolveDoorPos(d, wallList);
		const wallRad = (pos.angleDeg * Math.PI) / 180;
		const dirX = Math.cos(wallRad), dirY = Math.sin(wallRad);
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

	function migrateDoors(rawDoors: Door[], wallList: Wall[]): Door[] {
		return rawDoors.map(d => {
			if (d.wallId) return d;
			let best = { d: Infinity, wallId: '', segIndex: 0, t: 0 };
			for (const w of wallList) {
				for (let i = 0; i < w.points.length - 1; i++) {
					const a = w.points[i], b = w.points[i + 1];
					const c = closestOnSeg(d.x, d.y, a.x, a.y, b.x, b.y);
					const dd = Math.hypot(d.x - c.x, d.y - c.y);
					if (dd < best.d) best = { d: dd, wallId: w.id, segIndex: i, t: c.t };
				}
			}
			return { ...d, wallId: best.wallId, segIndex: best.segIndex, t: best.t };
		});
	}

	// ─── Floor mutators ─────────────────────────────────────────────────────
	const SNAP_JOIN = 2;

	function propagateVertexMoves(walls: Wall[], moves: { from: Point; to: Point }[], excludeWallId?: string): Wall[] {
		if (moves.length === 0) return walls;
		return walls.map(w => {
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

	function patchFloor(id: string, patch: Partial<Floor>) {
		editFloors = editFloors.map(f => f.id === id ? { ...f, ...patch } : f);
	}
	function updateWalls(fn: (walls: Wall[]) => Wall[]) {
		patchFloor(activeFloorId, { walls: fn(activeFloor.walls) });
	}
	function updateDoors(fn: (doors: Door[]) => Door[]) {
		patchFloor(activeFloorId, { doors: fn(activeFloor.doors) });
	}
	function updateFixtures(fn: (fixtures: Fixture[]) => Fixture[]) {
		patchFloor(activeFloorId, { fixtures: fn(activeFloor.fixtures) });
	}
	function updateAreas(fn: (areas: FloorArea[]) => FloorArea[]) {
		patchFloor(activeFloorId, { areas: fn(activeFloor.areas) });
	}

	// ─── Viewbox ────────────────────────────────────────────────────────────
	const SIDEBAR_REM = 17.5;
	const W = $derived(activeFloor.world.w);
	const H = $derived(activeFloor.world.h);
	const vbW = $derived(W / zoom);
	const vbH = $derived(H / zoom);

	const pxPerUnit = $derived(svgClientW > 0 && vbW > 0 ? svgClientW / vbW : 1);
	const SCALE_STEPS = [50, 100, 200, 500, 1000, 2000, 5000];
	const scaleCm = $derived(SCALE_STEPS.find(s => s * pxPerUnit >= 60) ?? 1000);
	const scaleBarPx = $derived(scaleCm * pxPerUnit);

	let didInitialFit = false;
	$effect(() => {
		const svg = svgRef;
		if (!svg) return;
		svgClientW = svg.clientWidth;
		if (didInitialFit) return;
		didInitialFit = true;
		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
		const sidebarPx = SIDEBAR_REM * rem + 24;
		const availW = svg.clientWidth - sidebarPx;
		const availH = svg.clientHeight - 80;
		if (availW <= 0 || availH <= 0) return;
		const fitZoom = Math.min(availW / W, availH / H, 1.5);
		zoom = Math.round(fitZoom * 100) / 100;
		const contentW = W * fitZoom;
		panX = -(availW - contentW) / (2 * fitZoom);
		panY = -(40 / fitZoom);
	});

	$effect(() => {
		const svg = svgRef;
		if (!svg) return;
		const ro = new ResizeObserver(() => { svgClientW = svg.clientWidth; });
		ro.observe(svg);
		return () => ro.disconnect();
	});

	function toWorld(clientX: number, clientY: number, snap = true): Point {
		const svg = svgRef;
		if (!svg) return { x: 0, y: 0 };
		const pt = svg.createSVGPoint();
		pt.x = clientX; pt.y = clientY;
		const ctm = svg.getScreenCTM();
		if (!ctm) return { x: 0, y: 0 };
		const w = pt.matrixTransform(ctm.inverse());
		if (!snap) return { x: w.x, y: w.y };
		return { x: snapToGrid(w.x), y: snapToGrid(w.y) };
	}

	function snapToEndpoints(p: Point): Point & { snapped?: string } {
		let best: Point | null = null, bestD = SNAP_ENDPOINT_CM;
		for (const w of activeFloor.walls) {
			for (const pt of w.points) {
				const d = Math.hypot(p.x - pt.x, p.y - pt.y);
				if (d < bestD) { best = pt; bestD = d; }
			}
		}
		return best ? { ...best, snapped: 'endpoint' } : p;
	}

	function findNearestWallPoint(p: Point): { wallId: string; segIndex: number; t: number } | null {
		let best: { wallId: string; segIndex: number; t: number; d: number } | null = null;
		for (const w of activeFloor.walls) {
			for (let i = 0; i < w.points.length - 1; i++) {
				const a = w.points[i], b = w.points[i + 1];
				const c = closestOnSeg(p.x, p.y, a.x, a.y, b.x, b.y);
				const d = Math.hypot(p.x - c.x, p.y - c.y);
				if (d < 60 && (!best || d < best.d)) best = { wallId: w.id, segIndex: i, t: c.t, d };
			}
		}
		return best;
	}

	// ─── Selection helpers ──────────────────────────────────────────────────
	function isSel(kind: string, id: string): boolean {
		return selected != null && selected.kind === kind && selected.id === id;
	}

	function deleteSelected() {
		if (!selected) return;
		pushUndo();
		const { kind, id } = selected;
		if (kind === 'wall') {
			patchFloor(activeFloorId, {
				walls: activeFloor.walls.filter(w => w.id !== id),
				doors: activeFloor.doors.filter(d => d.wallId !== id),
			});
		}
		if (kind === 'door') updateDoors(ds => ds.filter(d => d.id !== id));
		if (kind === 'fixture') updateFixtures(fs => fs.filter(f => f.id !== id));
		if (kind === 'area') updateAreas(as2 => as2.filter(a => a.id !== id));
		if (kind === 'vertex') {
			const [wallId, idxStr] = id.split('::');
			updateWalls(ws => ws.map(w => {
				if (w.id !== wallId || w.points.length <= 2) return w;
				return { ...w, points: w.points.filter((_, i) => i !== +idxStr) };
			}));
		}
		if (kind === 'segment') {
			const [wallId, idxStr] = id.split('::');
			const segIdx = +idxStr;
			const wall = activeFloor.walls.find(w => w.id === wallId);
			if (wall) {
				if (wall.points.length <= 3) {
					patchFloor(activeFloorId, {
						walls: activeFloor.walls.filter(w => w.id !== wallId),
						doors: activeFloor.doors.filter(d => d.wallId !== wallId),
					});
				} else {
					const idxB = (segIdx + 1) % wall.points.length;
					const removeIdx = wall.closed ? idxB : Math.max(segIdx, idxB);
					updateWalls(ws => ws.map(w => {
						if (w.id !== wallId) return w;
						return { ...w, points: w.points.filter((_, i) => i !== removeIdx) };
					}));
				}
			}
		}
		selected = null;
	}

	// ─── Derived ────────────────────────────────────────────────────────────
	const selectedWall = $derived.by(() => {
		if (!selected) return null;
		if (selected.kind !== 'wall' && selected.kind !== 'vertex' && selected.kind !== 'segment') return null;
		const wallId = selected.kind === 'wall' ? selected.id : selected.id.split('::')[0];
		return activeFloor.walls.find(x => x.id === wallId) ?? null;
	});

	const wallPreview = $derived.by(() => {
		if (drawing?.kind !== 'wall' || !mouseWorld || !drawing.points || drawing.points.length === 0) return null;
		const last = drawing.points[drawing.points.length - 1];
		const first = drawing.points[0];
		const snapped = snapToEndpoints(mouseWorld);
		const pt = snapVecAngle(last.x, last.y, snapped.x, snapped.y);
		const ptSnapped = { x: snapToGrid(pt.x), y: snapToGrid(pt.y) };
		const len = dist(last, ptSnapped);
		const canClose = drawing.points.length >= 3 && dist(ptSnapped, first) < SNAP_ENDPOINT_CM;
		return { last, ptSnapped, len, isEndpointSnap: (snapped as any).snapped === 'endpoint', canClose, first };
	});

	const AREA_TINT: Record<string, { bg: string; overlay: string | null }> = {
		main: { bg: 'url(#se-floor)', overlay: null },
		bar: { bg: 'var(--fr-surface)', overlay: null },
		garden: { bg: 'url(#se-garden)', overlay: 'color-mix(in oklch, var(--fr-success) 6%, transparent)' },
		priv: { bg: 'color-mix(in oklch, var(--fr-accent) 4%, var(--fr-surface))', overlay: null }
	};

	// ─── Canvas handlers ────────────────────────────────────────────────────
	function onCanvasMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;
		if (spaceHeld) {
			e.preventDefault();
			dragRef = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, startPanX: panX, startPanY: panY };
			return;
		}
		const w = toWorld(e.clientX, e.clientY);

		if (tool === 'wall') {
			e.preventDefault();
			const snapped = snapToEndpoints(w);
			if (drawing && drawing.kind === 'wall' && drawing.points && drawing.points.length > 0) {
				const first = drawing.points[0];
				const last = drawing.points[drawing.points.length - 1];
				const finalPt = !e.shiftKey ? snapVecAngle(last.x, last.y, snapped.x, snapped.y) : snapped;
				const fp2 = { x: snapToGrid(finalPt.x), y: snapToGrid(finalPt.y) };
				if (drawing.points.length >= 3 && dist(fp2, first) < SNAP_ENDPOINT_CM) {
					pushUndo();
					const segs = splitIntoSegments(drawing.points, true);
					updateWalls(ws => [...ws, ...segs]);
					drawing = null; tool = 'select';
				} else {
					drawing = { ...drawing, points: [...drawing.points, fp2] };
				}
			} else {
				drawing = { kind: 'wall', points: [snapped] };
			}
			return;
		}
		if (tool === 'area') {
			e.preventDefault();
			drawing = { kind: 'area', x1: w.x, y1: w.y, x2: w.x, y2: w.y };
			dragRef = { kind: 'draw-area' };
			return;
		}
		if (tool === 'door') {
			e.preventDefault();
			const attach = findNearestWallPoint(w);
			if (!attach) return;
			pushUndo();
			const id = `d-${Date.now().toString(36)}`;
			updateDoors(ds => [...ds, { id, wallId: attach.wallId, segIndex: attach.segIndex, t: attach.t, width: 80, hinge: 'left' as const, swing: 'in' as const, open: 90, label: '', x: 0, y: 0, wallAngle: 0 }]);
			selected = { kind: 'door', id };
			tool = 'select';
			return;
		}
		if (tool === 'fixture') {
			e.preventDefault();
			pushUndo();
			const id = `f-${Date.now().toString(36)}`;
			updateFixtures(fs => [...fs, { id, x: w.x - 40, y: w.y - 25, w: 80, h: 50, label: 'Fixture', kind: 'host' as const }]);
			selected = { kind: 'fixture', id };
			tool = 'select';
			return;
		}
		if (tool === 'select') selected = null;

		e.preventDefault();
		dragRef = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, startPanX: panX, startPanY: panY };
	}

	function onItemMouseDown(e: MouseEvent, kind: string, id: string) {
		if (spaceHeld) {
			e.stopPropagation(); e.preventDefault();
			dragRef = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, startPanX: panX, startPanY: panY };
			return;
		}
		if (tool !== 'select') return;
		e.stopPropagation();
		e.preventDefault();
		pushUndo();
		selected = { kind, id };
		const start = toWorld(e.clientX, e.clientY);

		if (kind === 'fixture') {
			const item = activeFloor.fixtures.find(f => f.id === id);
			if (item) dragRef = { kind: 'move', id, dx: item.x - start.x, dy: item.y - start.y };
		} else if (kind === 'area') {
			const item = activeFloor.areas.find(a => a.id === id);
			if (item) dragRef = { kind: 'move-area', id, dx: item.x - start.x, dy: item.y - start.y };
		} else if (kind === 'door') {
			const door = activeFloor.doors.find(d => d.id === id);
			if (!door) return;
			const pos = resolveDoorPos(door, activeFloor.walls);
			dragRef = { kind: 'slide-door', id, dx: pos.x - start.x, dy: pos.y - start.y, origWallId: door.wallId ?? '', origSegIndex: door.segIndex ?? 0, origT: door.t ?? 0.5 };
			doorDragPos = { x: pos.x, y: pos.y, angle: pos.angleDeg };
			doorSnapCandidate = null;
		} else if (kind === 'wall') {
			const wall = activeFloor.walls.find(w => w.id === id);
			if (!wall) return;
			const segCount = wall.closed ? wall.points.length : wall.points.length - 1;
			let bestSeg = 0, bestDist = Infinity;
			for (let i = 0; i < segCount; i++) {
				const a = wall.points[i], b = wall.points[(i + 1) % wall.points.length];
				const c = closestOnSeg(start.x, start.y, a.x, a.y, b.x, b.y);
				const d = Math.hypot(start.x - c.x, start.y - c.y);
				if (d < bestDist) { bestDist = d; bestSeg = i; }
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
		selected = { kind: 'vertex', id: `${wallId}::${idx}` };
		dragRef = { kind: 'drag-vertex', wallId, idx };
	}

	function onMidpointMouseDown(e: MouseEvent, wallId: string, idx: number) {
		e.stopPropagation(); e.preventDefault();
		if (spaceHeld) { dragRef = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, startPanX: panX, startPanY: panY }; return; }
		pushUndo();
		const wall = activeFloor.walls.find(w => w.id === wallId);
		if (!wall) return;
		const a = wall.points[idx], b = wall.points[idx + 1];
		const mid = { x: snapToGrid((a.x + b.x) / 2), y: snapToGrid((a.y + b.y) / 2) };
		updateWalls(ws => ws.map(w => {
			if (w.id !== wallId) return w;
			const pts = [...w.points];
			pts.splice(idx + 1, 0, mid);
			return { ...w, points: pts };
		}));
		selected = { kind: 'vertex', id: `${wallId}::${idx + 1}` };
		dragRef = { kind: 'drag-vertex', wallId, idx: idx + 1 };
	}

	// ─── Global mouse move/up ───────────────────────────────────────────────
	$effect(() => {
		const onMove = (e: MouseEvent) => {
			if (!dragRef && !drawing) { if (tool !== 'select') mouseWorld = toWorld(e.clientX, e.clientY, false); return; }
			const dr = dragRef;
			if (dr?.kind === 'pan') {
				const svg = svgRef;
				if (!svg) return;
				const scale = vbW / svg.clientWidth;
				panX = (dr.startPanX ?? 0) - (e.clientX - (dr.startClientX ?? 0)) * scale;
				panY = (dr.startPanY ?? 0) - (e.clientY - (dr.startClientY ?? 0)) * scale;
				return;
			}
			const w = toWorld(e.clientX, e.clientY);
			const wRaw = toWorld(e.clientX, e.clientY, false);
			mouseWorld = wRaw;

			if (dr?.kind === 'draw-area') {
				if (drawing) drawing = { ...drawing, x2: w.x, y2: w.y };
				return;
			}
			if (dr?.kind === 'move') {
				const nx = w.x + (dr.dx ?? 0), ny = w.y + (dr.dy ?? 0);
				updateFixtures(fs => fs.map(f => f.id === dr.id ? { ...f, x: nx, y: ny } : f));
				return;
			}
			if (dr?.kind === 'move-area') {
				const nx = w.x + (dr.dx ?? 0), ny = w.y + (dr.dy ?? 0);
				updateAreas(as2 => as2.map(a => a.id === dr.id ? { ...a, x: nx, y: ny } : a));
				return;
			}
			if (dr?.kind === 'drag-vertex') {
				let p = { ...w };
				let best: Point | null = null, bestD = SNAP_ENDPOINT_CM;
				for (const ww of activeFloor.walls)
					for (let i = 0; i < ww.points.length; i++) {
						if (ww.id === dr.wallId && i === dr.idx) continue;
						const dd = Math.hypot(p.x - ww.points[i].x, p.y - ww.points[i].y);
						if (dd < bestD) { best = ww.points[i]; bestD = dd; }
					}
				if (best) p = { x: best.x, y: best.y };
				const wall = activeFloor.walls.find(x => x.id === dr.wallId);
				if (wall) {
					const prevIdx = (dr.idx ?? 0) > 0 ? (dr.idx ?? 0) - 1 : wall.closed ? wall.points.length - 1 : null;
					if (prevIdx != null && !e.shiftKey) {
						const prev = wall.points[prevIdx];
						p = snapVecAngle(prev.x, prev.y, p.x, p.y);
						p = { x: snapToGrid(p.x), y: snapToGrid(p.y) };
					}
					const oldPt = wall.points[dr.idx ?? 0];
					const moves = [{ from: oldPt, to: p }];
					const updated = activeFloor.walls.map(ww => {
						if (ww.id !== dr.wallId) return ww;
						return { ...ww, points: ww.points.map((pp, i) => i === dr.idx ? p : pp) };
					});
					patchFloor(activeFloorId, { walls: propagateVertexMoves(updated, moves, dr.wallId) });
				}
				return;
			}
			if (dr?.kind === 'move-wall') {
				const dx = w.x - (dr.sx ?? 0), dy = w.y - (dr.sy ?? 0);
				const origPts = dr.originalPoints ?? [];
				const moves = origPts.map(p => ({
					from: p,
					to: { x: snapToGrid(p.x + dx), y: snapToGrid(p.y + dy) },
				}));
				const updated = activeFloor.walls.map(ww =>
					ww.id === dr.id
						? { ...ww, points: moves.map(m => m.to) }
						: ww
				);
				patchFloor(activeFloorId, { walls: propagateVertexMoves(updated, moves, dr.id) });
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
				const moves = [
					{ from: origPts[0], to: newA },
					{ from: origPts[1], to: newB },
				];
				const idxB = (segIdx + 1) % (activeFloor.walls.find(ww => ww.id === dr.wallId)?.points.length ?? 2);
				const updated = activeFloor.walls.map(ww => {
					if (ww.id !== dr.wallId) return ww;
					return { ...ww, points: ww.points.map((p, i) => {
						if (i === segIdx) return newA;
						if (i === idxB) return newB;
						return p;
					})};
				});
				patchFloor(activeFloorId, { walls: propagateVertexMoves(updated, moves, dr.wallId) });
				return;
			}
			if (dr?.kind === 'slide-door') {
				const freeX = wRaw.x + (dr.dx ?? 0), freeY = wRaw.y + (dr.dy ?? 0);
				const snap = findBestWallSnap(freeX, freeY);
				if (snap && snap.dist <= DOOR_SNAP_THRESHOLD) {
					doorSnapCandidate = { wallId: snap.wallId, segIndex: snap.segIndex, t: snap.t, x: snap.x, y: snap.y, angle: snap.angle };
					doorDragPos = { x: freeX, y: freeY, angle: snap.angle };
				} else {
					doorSnapCandidate = null;
					doorDragPos = { x: freeX, y: freeY, angle: doorDragPos?.angle ?? 0 };
				}
				return;
			}
		};

		const onUp = () => {
			if (dragRef?.kind === 'slide-door') {
				const dr = dragRef;
				if (doorSnapCandidate) {
					updateDoors(ds => ds.map(d => d.id === dr.id ? { ...d, wallId: doorSnapCandidate!.wallId, segIndex: doorSnapCandidate!.segIndex, t: doorSnapCandidate!.t } : d));
				} else {
					updateDoors(ds => ds.map(d => d.id === dr.id ? { ...d, wallId: dr.origWallId, segIndex: dr.origSegIndex, t: dr.origT } : d));
				}
				doorDragPos = null;
				doorSnapCandidate = null;
				dragRef = null;
				return;
			}
			if (dragRef?.kind === 'draw-area' && drawing && drawing.kind === 'area') {
				const x = Math.min(drawing.x1!, drawing.x2!), y = Math.min(drawing.y1!, drawing.y2!);
				const dw = Math.abs(drawing.x2! - drawing.x1!), dh = Math.abs(drawing.y2! - drawing.y1!);
				if (dw > 30 && dh > 30) {
					pushUndo();
					const id = `a-${Date.now().toString(36)}`;
					updateAreas(as2 => [...as2, { id, name: 'New area', x, y, w: dw, h: dh, tint: 'main' as AreaTint }]);
					selected = { kind: 'area', id };
				}
				drawing = null;
				tool = 'select';
			}
			dragRef = null;
		};

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
		return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
	});

	function splitIntoSegments(points: Point[], close: boolean): Wall[] {
		const segs: Wall[] = [];
		const count = close ? points.length : points.length - 1;
		for (let i = 0; i < count; i++) {
			const a = points[i];
			const b = points[(i + 1) % points.length];
			segs.push({
				id: `w-${Date.now().toString(36)}-${i}`,
				closed: false,
				thickness: 6,
				points: [{ ...a }, { ...b }],
			});
		}
		return segs;
	}

	function finishWallOpen() {
		if (drawing?.kind !== 'wall' || !drawing.points || drawing.points.length < 2) return;
		pushUndo();
		const segs = splitIntoSegments(drawing.points, false);
		updateWalls(ws => [...ws, ...segs]);
		drawing = null; tool = 'select';
	}

	// ─── Keyboard handler ───────────────────────────────────────────────────
	$effect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === ' ') { e.preventDefault(); spaceHeld = true; return; }
			if (['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement as HTMLElement)?.tagName)) return;
			if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
			if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || e.key === 'y')) { e.preventDefault(); redo(); return; }
			if (e.key === 'Escape') { drawing = null; tool = 'select'; selected = null; return; }
			if (e.key === 'Enter' && drawing?.kind === 'wall') {
				finishWallOpen();
				return;
			}
			if (!selected) return;
			if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
			const step = e.shiftKey ? 20 : 5;
			let dx = 0, dy = 0;
			if (e.key === 'ArrowLeft') dx = -step;
			else if (e.key === 'ArrowRight') dx = step;
			else if (e.key === 'ArrowUp') dy = -step;
			else if (e.key === 'ArrowDown') dy = step;
			else return;
			e.preventDefault();
			pushUndo();
			const { kind, id } = selected;
			if (kind === 'fixture') {
				updateFixtures(fs => fs.map(f => f.id === id ? { ...f, x: f.x + dx, y: f.y + dy } : f));
			} else if (kind === 'area') {
				updateAreas(as2 => as2.map(a => a.id === id ? { ...a, x: a.x + dx, y: a.y + dy } : a));
			} else if (kind === 'vertex') {
				const [wallId, idxS] = id.split('::');
				updateWalls(ws => ws.map(w => {
					if (w.id !== wallId) return w;
					return { ...w, points: w.points.map((p, i) => i === +idxS ? { x: p.x + dx, y: p.y + dy } : p) };
				}));
			}
		};
		const onKeyUp = (e: KeyboardEvent) => {
			if (e.key === ' ') spaceHeld = false;
		};
		window.addEventListener('keydown', onKey);
		window.addEventListener('keyup', onKeyUp);
		return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
	});

	// ─── Property editor helpers ────────────────────────────────────────────
	function getSelectedItem() {
		if (!selected) return null;
		const { kind, id } = selected;
		if (kind === 'wall') return { kind, item: activeFloor.walls.find(w => w.id === id) };
		if (kind === 'door') return { kind, item: activeFloor.doors.find(d => d.id === id) };
		if (kind === 'fixture') return { kind, item: activeFloor.fixtures.find(f => f.id === id) };
		if (kind === 'area') return { kind, item: activeFloor.areas.find(a => a.id === id) };
		if (kind === 'vertex') {
			const [wallId, idxS] = id.split('::');
			return { kind, item: activeFloor.walls.find(w => w.id === wallId), idx: +idxS };
		}
		if (kind === 'segment') {
			const [wallId, idxS] = id.split('::');
			return { kind, item: activeFloor.walls.find(w => w.id === wallId), idx: +idxS };
		}
		return null;
	}
</script>

<div style="position: relative; flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 37.5rem">
	<!-- Floating toolbar -->
	<div style="position: absolute; top: 0.75rem; left: 0.75rem; right: 0.75rem; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 0.625rem; padding: 0.375rem 0.625rem; background: color-mix(in oklch, var(--fr-surface) 92%, transparent); backdrop-filter: blur(12px); border: 1px solid var(--fr-border); border-radius: var(--fr-radius); box-shadow: var(--fr-shadow-md)">
		<div style="display: flex; align-items: center; gap: 0.375rem">
			<div class="fr-segment">
				{#each editFloors as f (f.id)}
					{#if renamingFloorId === f.id}
						<input
							class="fr-input"
							style="width: 8rem; height: 1.75rem; font-size: 0.8125rem; padding: 0 0.5rem"
							bind:value={renameValue}
							onkeydown={(e) => { if (e.key === 'Enter') commitRenameFloor(); if (e.key === 'Escape') renamingFloorId = null; }}
							onblur={() => commitRenameFloor()}
							autofocus
						/>
					{:else}
						<button
							class="fr-segment-btn"
							class:active={activeFloorId === f.id}
							onclick={() => { activeFloorId = f.id; selected = null; drawing = null; tool = 'select'; }}
							ondblclick={() => startRenameFloor(f.id)}
							title="Double-click to rename"
						>
							{f.name}
						</button>
					{/if}
				{/each}
			</div>
			<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => addFloor()} title="Add floor" style="width: 1.75rem; height: 1.75rem; padding: 0; justify-content: center"><Plus size={14} /></button>
		</div>
		<div style="display: flex; gap: 0.375rem; align-items: center">
			<div class="fr-segment">
				<button class:active={units === 'metric'} onclick={() => { units = 'metric'; }}>m</button>
				<button class:active={units === 'imperial'} onclick={() => { units = 'imperial'; }}>ft</button>
			</div>
			<button class="fr-btn fr-btn-primary" onclick={() => onsave(JSON.parse(JSON.stringify($state.snapshot(editFloors))), JSON.parse(JSON.stringify($state.snapshot(editTables))))}><Check size={14} /> Save layout</button>
		</div>
	</div>

		<!-- Canvas (fills entire content area) -->
		<div style="position: absolute; inset: 0; overflow: hidden; background: var(--fr-bg)">
			<!-- Tool palette (below floating toolbar) -->
			<div class="se-tool-palette" style="position: absolute; left: 0.75rem; top: 3.75rem; z-index: 5; display: flex; flex-direction: column; gap: 0.25rem; padding: 0.25rem; background: var(--fr-surface); border: 1px solid var(--fr-border); border-radius: var(--fr-radius); box-shadow: var(--fr-shadow-md)">
				{#each [
					{ id: 'select', label: 'Select', desc: 'Click to select · drag to move', icon: MousePointer },
					{ id: 'wall', label: 'Draw wall', desc: 'Click points · right-click to finish', icon: PenTool },
					{ id: 'door', label: 'Place door', desc: 'Click on a wall to place', icon: DoorOpen },
					{ id: 'fixture', label: 'Add fixture', desc: 'Click canvas to place', icon: Briefcase },
					{ id: 'area', label: 'Draw area', desc: 'Click and drag a zone', icon: Square },
				] as t (t.id)}
					<div class="se-tool-wrap">
						<button
							class="fr-btn fr-btn-sm {tool === t.id ? 'fr-btn-primary' : 'fr-btn-ghost'}"
							onclick={() => { tool = t.id as typeof tool; drawing = null; }}
							style="width: 2rem; height: 2rem; padding: 0; justify-content: center"
						><t.icon size={14} /></button>
						<div class="se-tool-tip">
							<strong>{t.label}</strong>
							<span>{t.desc}</span>
						</div>
					</div>
				{/each}
			</div>

			<!-- Zoom controls (bottom-right) -->
			<div style="position: absolute; right: 0.75rem; bottom: 0.75rem; z-index: 11">
				<div class="fr-segment" style="background: color-mix(in oklch, var(--fr-surface-muted) 80%, transparent); backdrop-filter: blur(12px)">
					<button onclick={() => { zoom = Math.max(0.5, zoom - 0.15); }}>&minus;</button>
					<span style="font-size: 12px; font-variant-numeric: tabular-nums; display: grid; place-items: center; min-width: 44px; color: var(--fr-text-muted)">{Math.round(zoom * 100)}%</span>
					<button onclick={() => { zoom = Math.min(2, zoom + 0.15); }}>+</button>
				</div>
			</div>

			<!-- Scale bar (bottom-left) -->
			<div style="position: absolute; left: 0.75rem; bottom: 0.75rem; z-index: 5; padding: 0.375rem 0.625rem; background: color-mix(in oklch, var(--fr-surface-muted) 80%, transparent); backdrop-filter: blur(12px); border: 1px solid var(--fr-border); border-radius: var(--fr-radius); display: flex; align-items: center; gap: 0.5rem; font-family: var(--fr-font-mono); font-size: 0.6875rem">
				<div style="width: {scaleBarPx}px; height: 6px; background: var(--fr-text); position: relative">
					<div style="position: absolute; left: 0; top: -4px; width: 1px; height: 14px; background: var(--fr-text)"></div>
					<div style="position: absolute; right: 0; top: -4px; width: 1px; height: 14px; background: var(--fr-text)"></div>
				</div>
				<span style="color: var(--fr-text-muted)">{fmtLen(scaleCm, units)}</span>
			</div>

			<!-- Hint bar (above scale bar) -->
			{#if drawing?.kind === 'wall'}
				<div style="position: absolute; left: 0.75rem; bottom: 3rem; z-index: 5; padding: 0.375rem 0.625rem; background: var(--fr-surface); border: 1px solid var(--fr-accent); border-radius: var(--fr-radius); font-size: 0.72rem; color: var(--fr-accent); font-weight: 500; font-family: var(--fr-font-mono)">
					{drawing.points?.length ?? 0} pt{(drawing.points?.length ?? 0) > 1 ? 's' : ''} · Click first point to close · Right-click or Enter to finish · Esc cancel
				</div>
			{/if}

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				style="width: 100%; height: 100%; overflow: hidden"
				onwheel={(e) => {
					e.preventDefault();
					const oldZoom = zoom;
					const delta = e.deltaY > 0 ? -0.08 : 0.08;
					const newZoom = Math.max(0.3, Math.min(3, oldZoom + delta));
					if (svgRef) {
						const rect = svgRef.getBoundingClientRect();
						const mx = (e.clientX - rect.left) / rect.width;
						const my = (e.clientY - rect.top) / rect.height;
						const oldW2 = W / oldZoom, oldH2 = H / oldZoom;
						const newW2 = W / newZoom, newH2 = H / newZoom;
						panX += (oldW2 - newW2) * mx;
						panY += (oldH2 - newH2) * my;
					}
					zoom = newZoom;
				}}
			>
				<svg
					bind:this={svgRef}
					viewBox="{panX} {panY} {vbW} {vbH}"
					preserveAspectRatio="xMidYMid meet"
					onmousedown={onCanvasMouseDown}
					onmousemove={(e) => { mouseWorld = toWorld(e.clientX, e.clientY, false); }}
					oncontextmenu={(e) => {
						if (drawing?.kind === 'wall') { e.preventDefault(); finishWallOpen(); }
					}}
					style="width: 100%; height: 100%; display: block; cursor: {dragRef?.kind === 'pan' ? 'grabbing' : spaceHeld ? 'grab' : tool !== 'select' ? 'crosshair' : 'grab'}"
				>
					<defs>
						<pattern id="se-grid-minor" width={GRID_MINOR_CM} height={GRID_MINOR_CM} patternUnits="userSpaceOnUse">
							<path d="M {GRID_MINOR_CM} 0 L 0 0 0 {GRID_MINOR_CM}" fill="none" stroke="var(--fr-border)" stroke-width="0.4" opacity="0.4" />
						</pattern>
						<pattern id="se-grid-major" width={GRID_CM} height={GRID_CM} patternUnits="userSpaceOnUse">
							<path d="M {GRID_CM} 0 L 0 0 0 {GRID_CM}" fill="none" stroke="var(--fr-border-strong)" stroke-width="0.7" opacity="0.55" />
						</pattern>
						<pattern id="se-floor" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
							<line x1="0" y1="0" x2="0" y2="60" stroke="var(--fr-border)" stroke-width="0.6" opacity="0.4" />
						</pattern>
						<pattern id="se-garden" width="14" height="14" patternUnits="userSpaceOnUse">
							<circle cx="2" cy="2" r="1" fill="var(--fr-success)" opacity="0.18" />
						</pattern>
						<pattern id="se-banq" width="10" height="10" patternUnits="userSpaceOnUse">
							<line x1="0" y1="0" x2="10" y2="10" stroke="var(--fr-border-strong)" stroke-width="0.8" opacity="0.6" />
						</pattern>
					</defs>

					<!-- Areas -->
					<g>
						{#each activeFloor.areas as a (a.id)}
							{@const tint = AREA_TINT[a.tint] || AREA_TINT.main}
							{@const sel = isSel('area', a.id)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<g onmousedown={(e) => onItemMouseDown(e, 'area', a.id)} style="cursor: {tool === 'select' ? 'move' : 'default'}">
								<rect x={a.x} y={a.y} width={a.w} height={a.h} fill={tint.bg} stroke={sel ? 'var(--fr-accent)' : 'transparent'} stroke-width={sel ? 2 : 0} stroke-dasharray={sel ? '4 3' : ''} />
								{#if tint.overlay}
									<rect x={a.x} y={a.y} width={a.w} height={a.h} fill={tint.overlay} pointer-events="none" />
								{/if}
							</g>
						{/each}
					</g>

					<!-- Grid -->
					{#if showGrid}
						<rect x="0" y="0" width={W} height={H} fill="url(#se-grid-minor)" pointer-events="none" />
						<rect x="0" y="0" width={W} height={H} fill="url(#se-grid-major)" pointer-events="none" />
					{/if}

					<!-- Walls -->
					<g>
						{#each activeFloor.walls as w (w.id)}
							{@const isWallSelected = selectedWall?.id === w.id}
							{@const selSegIdx = selected?.kind === 'segment' && selected.id.startsWith(w.id + '::') ? +selected.id.split('::')[1] : -1}
							{@const d = w.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (w.closed ? ' Z' : '')}
							<g>
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<path d={d} fill="none" stroke="transparent" stroke-width={Math.max(w.thickness + 8, 14)} stroke-linecap="square"
									onmousedown={(e) => onItemMouseDown(e, 'wall', w.id)} style="cursor: {tool === 'select' ? 'move' : 'default'}" />
								<path d={d} fill="none" stroke={isWallSelected ? 'var(--fr-text)' : 'var(--fr-text)'} stroke-width={w.thickness} stroke-linecap="square" stroke-linejoin="miter" opacity={isWallSelected ? 0.5 : 0.85} pointer-events="none" />
								{#if selSegIdx >= 0}
									{@const a = w.points[selSegIdx]}
									{@const b = w.points[(selSegIdx + 1) % w.points.length]}
									<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--fr-accent)" stroke-width={w.thickness + 2} stroke-linecap="square" pointer-events="none" />
								{/if}
							</g>
						{/each}
					</g>

					<!-- Wall dimensions -->
					{#if showDims}
						<g style="pointer-events: none">
							{#each activeFloor.walls as w (w.id)}
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
												<g transform="translate({lx} {ly}) rotate({angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg})">
													<rect x="-22" y="-8" width="44" height="14" rx="2" fill="var(--fr-surface)" stroke="var(--fr-accent)" stroke-width="0.5" />
													<text x="0" y="3" text-anchor="middle" font-size="10" font-family="var(--fr-font-mono)" fill="var(--fr-accent)" font-weight="600">{fmtLen(len, units)}</text>
												</g>
											</g>
										{/if}
									{/each}
								{/if}
							{/each}
						</g>
					{/if}

					<!-- Wall drawing preview -->
					{#if wallPreview}
						<g style="pointer-events: none">
							<path d={drawing!.points!.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} fill="none" stroke="var(--fr-accent)" stroke-width="5" stroke-dasharray="6 4" opacity="0.8" />
							{#if wallPreview.canClose}
								<line x1={wallPreview.last.x} y1={wallPreview.last.y} x2={wallPreview.first.x} y2={wallPreview.first.y} stroke="var(--fr-success)" stroke-width="3" stroke-dasharray="4 3" opacity="0.8" />
							{:else}
								<line x1={wallPreview.last.x} y1={wallPreview.last.y} x2={wallPreview.ptSnapped.x} y2={wallPreview.ptSnapped.y} stroke="var(--fr-accent)" stroke-width="3" stroke-dasharray="4 3" opacity="0.6" />
							{/if}
							{#each drawing!.points! as p, i (i)}
								{#if i === 0 && drawing!.points!.length >= 3}
									<circle cx={p.x} cy={p.y} r={wallPreview.canClose ? 8 : 4} fill={wallPreview.canClose ? 'var(--fr-success)' : 'var(--fr-accent)'} opacity={wallPreview.canClose ? 0.3 : 1} />
									<circle cx={p.x} cy={p.y} r="4" fill="var(--fr-accent)" />
								{:else}
									<circle cx={p.x} cy={p.y} r="4" fill="var(--fr-accent)" />
								{/if}
							{/each}
							{#if wallPreview.canClose}
								<circle cx={wallPreview.first.x} cy={wallPreview.first.y} r="10" fill="none" stroke="var(--fr-success)" stroke-width="2" />
								<g transform="translate({wallPreview.first.x} {wallPreview.first.y - 18})">
									<rect x="-28" y="-9" width="56" height="16" rx="3" fill="var(--fr-success)" />
									<text x="0" y="3" text-anchor="middle" font-size="10" fill="white" font-weight="600">Close</text>
								</g>
							{:else}
								<circle cx={wallPreview.ptSnapped.x} cy={wallPreview.ptSnapped.y} r="5" fill="var(--fr-surface)" stroke="var(--fr-accent)" stroke-width="2" />
								{#if wallPreview.isEndpointSnap}
									<circle cx={wallPreview.ptSnapped.x} cy={wallPreview.ptSnapped.y} r="9" fill="none" stroke="var(--fr-accent)" stroke-width="1" stroke-dasharray="2 2" />
								{/if}
							{/if}
							{#if !wallPreview.canClose && wallPreview.len > 10}
								<g transform="translate({(wallPreview.last.x + wallPreview.ptSnapped.x) / 2} {(wallPreview.last.y + wallPreview.ptSnapped.y) / 2 - 14})">
									<rect x="-26" y="-9" width="52" height="16" rx="3" fill="var(--fr-accent)" />
									<text x="0" y="3" text-anchor="middle" font-size="11" font-family="var(--fr-font-mono)" fill="white" font-weight="600">{fmtLen(wallPreview.len, units)}</text>
								</g>
							{/if}
						</g>
					{/if}

					<!-- Area drawing preview -->
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
						{#each activeFloor.doors as d (d.id)}
							{@const sel = isSel('door', d.id)}
							{@const isDragging = !!(dragRef?.kind === 'slide-door' && dragRef.id === d.id && doorDragPos)}
							{#if isDragging}
								{@const g = doorSnapCandidate
									? computeDoorGeom(doorSnapCandidate.x, doorSnapCandidate.y, doorSnapCandidate.angle, d)
									: computeDoorGeom(doorDragPos!.x, doorDragPos!.y, doorDragPos!.angle, d)}
								{@const px = doorSnapCandidate ? doorSnapCandidate.x : doorDragPos!.x}
								{@const py = doorSnapCandidate ? doorSnapCandidate.y : doorDragPos!.y}
								<!-- Dragging: render full door at cursor / snap position -->
								<g style="pointer-events: none">
									<line x1={px} y1={py} x2={g.closedEndX} y2={g.closedEndY} stroke="var(--fr-bg)" stroke-width="11" stroke-linecap="butt" />
									<path
										d="M {g.closedEndX} {g.closedEndY} A {d.width} {d.width} 0 0 {g.openRad >= 0 ? 1 : 0} {g.panelEndX} {g.panelEndY}"
										fill="none"
										stroke={doorSnapCandidate ? 'var(--fr-accent)' : 'var(--fr-text-muted)'}
										stroke-width="1.5"
										stroke-dasharray="4 3"
										opacity="0.8"
									/>
									<line x1={px} y1={py} x2={g.panelEndX} y2={g.panelEndY}
										stroke={doorSnapCandidate ? 'var(--fr-accent)' : 'var(--fr-text)'}
										stroke-width="3" stroke-linecap="round" opacity="0.9" />
									<circle cx={px} cy={py} r="5"
										fill={doorSnapCandidate ? 'var(--fr-accent)' : 'var(--fr-text)'} />
									{#if d.label}
										<text x={(px + g.closedEndX) / 2} y={(py + g.closedEndY) / 2 - 10} text-anchor="middle" font-size="10" fill="var(--fr-text-muted)" style="text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500">{d.label}</text>
									{/if}
								</g>
								{#if doorSnapCandidate}
									<circle cx={doorSnapCandidate.x} cy={doorSnapCandidate.y} r="10" fill="none" stroke="var(--fr-accent)" stroke-width="1.5" stroke-dasharray="3 2" style="pointer-events: none" />
								{/if}
							{:else}
								{@const geom = getDoorGeometry(d, activeFloor.walls)}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<g onmousedown={(e) => onItemMouseDown(e, 'door', d.id)} style="cursor: {tool === 'select' ? 'move' : 'default'}">
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
							{/if}
						{/each}
					</g>

					<!-- Vertex handles for selected wall -->
					{#if tool === 'select' && selectedWall}
						{@const sw = selectedWall}
						{@const segCount2 = sw.closed ? sw.points.length : sw.points.length - 1}
						<g>
							{#each { length: segCount2 } as _, i}
								{@const a = sw.points[i]}
								{@const b = sw.points[(i + 1) % sw.points.length]}
								{@const mx = (a.x + b.x) / 2}
								{@const my = (a.y + b.y) / 2}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<circle cx={mx} cy={my} r="7" fill="var(--fr-surface)" stroke="var(--fr-accent)" stroke-width="1.5" stroke-dasharray="2 2" style="cursor: crosshair"
									onmousedown={(e) => {
										e.stopPropagation(); e.preventDefault();
										pushUndo();
										const start = toWorld(e.clientX, e.clientY);
										selected = { kind: 'segment', id: `${sw.id}::${i}` };
										const origA = { ...sw.points[i] };
										const origB = { ...sw.points[(i + 1) % sw.points.length] };
										dragRef = { kind: 'move-seg', wallId: sw.id, idx: i, sx: start.x, sy: start.y, originalPoints: [origA, origB] };
									}}
									ondblclick={(e) => onMidpointMouseDown(e, sw.id, i)} />
							{/each}
							{#each sw.points as p, i (i)}
								{@const isSelV = selected?.kind === 'vertex' && selected.id === `${sw.id}::${i}`}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<rect x={p.x - 5} y={p.y - 5} width="10" height="10" fill={isSelV ? 'var(--fr-accent)' : 'var(--fr-surface)'} stroke="var(--fr-accent)" stroke-width="2" style="cursor: move" onmousedown={(e) => onVertexMouseDown(e, sw.id, i)} />
							{/each}
						</g>
					{/if}

					<!-- Fixtures -->
					<g>
						{#each activeFloor.fixtures as f (f.id)}
							{@const sel = isSel('fixture', f.id)}
							{@const stroke = sel ? 'var(--fr-accent)' : 'var(--fr-border-strong)'}
							{#if f.kind === 'banq'}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<g onmousedown={(e) => onItemMouseDown(e, 'fixture', f.id)} style="cursor: {tool === 'select' ? 'move' : 'default'}">
									<rect x={f.x} y={f.y} width={f.w} height={f.h} fill="url(#se-banq)" stroke={stroke} stroke-width={sel ? 2 : 1} />
								</g>
							{:else if f.kind === 'planter'}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<g onmousedown={(e) => onItemMouseDown(e, 'fixture', f.id)} style="cursor: {tool === 'select' ? 'move' : 'default'}">
									<circle cx={f.x + f.w / 2} cy={f.y + f.h / 2} r={f.w / 2} fill="color-mix(in oklch, var(--fr-success) 22%, var(--fr-surface))" stroke={sel ? 'var(--fr-accent)' : 'color-mix(in oklch, var(--fr-success) 50%, var(--fr-border))'} stroke-width={sel ? 2 : 1.5} />
								</g>
							{:else}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<g onmousedown={(e) => onItemMouseDown(e, 'fixture', f.id)} style="cursor: {tool === 'select' ? 'move' : 'default'}">
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
						{#each activeFloor.areas as a (a.id)}
							<text x={a.x + a.w / 2} y={a.y + 22} text-anchor="middle" font-size={a.w > 500 ? 13 : 11} fill="var(--fr-text-subtle)" font-weight="600" style="text-transform: uppercase; letter-spacing: 0.14em">{a.name}</text>
						{/each}
					</g>

					<!-- Tables (read-only grey outlines) -->
					<g style="pointer-events: none" opacity="0.4">
						{#each floorTables as t (t.id)}
							{@const rot = t.rot || 0}
							<g transform="translate({t.x} {t.y}) rotate({rot})">
								{#if t.shape === 'round'}
									<circle cx={0} cy={0} r={(t.d ?? 80) / 2} fill="none" stroke="var(--fr-border-strong)" stroke-width="1.5" stroke-dasharray="4 3" />
								{:else}
									<rect x={-(t.w ?? 100) / 2} y={-(t.h ?? 80) / 2} width={t.w ?? 100} height={t.h ?? 80} rx="6" fill="none" stroke="var(--fr-border-strong)" stroke-width="1.5" stroke-dasharray="4 3" />
								{/if}
							</g>
							<text x={t.x} y={t.y + 4} text-anchor="middle" font-size="10" fill="var(--fr-text-muted)" font-weight="600">{t.id}</text>
						{/each}
					</g>
				</svg>
			</div>
		</div>

		<!-- Floating right sidebar: property editor -->
		<aside style="position: absolute; top: 3.75rem; right: 0.75rem; max-height: calc(100% - 4.5rem); width: 17.5rem; z-index: 10; overflow: auto; display: flex; flex-direction: column; background: color-mix(in oklch, var(--fr-surface) 92%, transparent); backdrop-filter: blur(12px); border: 1px solid var(--fr-border); border-radius: var(--fr-radius); box-shadow: var(--fr-shadow-md)">
			{#if selected}
				{@const sel = getSelectedItem()}
				{#if sel?.kind === 'vertex' && sel.item}
					{@const wallId = selected.id.split('::')[0]}
					{@const idx = sel.idx ?? 0}
					{@const wall = sel.item as Wall}
					{@const p = wall.points[idx]}
					<div class="fr-card-head">
						<div>
							<div class="fr-card-title">Wall vertex</div>
							<div class="fr-card-sub">{wallId} point {idx + 1} / {wall.points.length}</div>
						</div>
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => selected = null}><X size={13} /></button>
					</div>
					<div style="padding: 16px; display: flex; flex-direction: column; gap: 14px">
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
							<div>
								<div class="fr-label">X</div>
								<input class="fr-input" type="number" value={Math.round(p.x)} oninput={(e) => { pushUndo(); updateWalls(ws => ws.map(w => { if (w.id !== wallId) return w; return { ...w, points: w.points.map((pp, i) => i === idx ? { ...pp, x: +(e.target as HTMLInputElement).value } : pp) }; })); }} />
							</div>
							<div>
								<div class="fr-label">Y</div>
								<input class="fr-input" type="number" value={Math.round(p.y)} oninput={(e) => { pushUndo(); updateWalls(ws => ws.map(w => { if (w.id !== wallId) return w; return { ...w, points: w.points.map((pp, i) => i === idx ? { ...pp, y: +(e.target as HTMLInputElement).value } : pp) }; })); }} />
							</div>
						</div>
						<button class="fr-btn" style="color: var(--fr-danger)" onclick={() => deleteSelected()} disabled={wall.points.length <= 2}><Trash2 size={13} /> Remove vertex</button>
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
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => selected = null}><X size={13} /></button>
					</div>
					<div style="padding: 1rem; display: flex; flex-direction: column; gap: 0.875rem">
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem">
							<div>
								<div class="fr-label">Start X</div>
								<input class="fr-input" type="number" value={Math.round(a.x)} readonly />
							</div>
							<div>
								<div class="fr-label">Start Y</div>
								<input class="fr-input" type="number" value={Math.round(a.y)} readonly />
							</div>
							<div>
								<div class="fr-label">End X</div>
								<input class="fr-input" type="number" value={Math.round(b.x)} readonly />
							</div>
							<div>
								<div class="fr-label">End Y</div>
								<input class="fr-input" type="number" value={Math.round(b.y)} readonly />
							</div>
						</div>
						<div>
							<div class="fr-label" style="display: flex; justify-content: space-between"><span>Thickness</span><strong>{wall.thickness}px</strong></div>
							<input type="range" min={2} max={14} step={1} value={wall.thickness} oninput={(e) => { pushUndo(); updateWalls(ws => ws.map(w => w.id === wall.id ? { ...w, thickness: +(e.target as HTMLInputElement).value } : w)); }} style="width: 100%" />
						</div>
						<p class="fr-subtle" style="font-size: 0.72rem; line-height: 1.5; margin: 0">Drag to move this segment. Click a vertex handle to edit points. Double-click a midpoint to split.</p>
						<button class="fr-btn fr-btn-sm" onclick={() => { selected = { kind: 'wall', id: wall.id }; }}>Select entire wall</button>
						<button class="fr-btn fr-btn-sm" style="color: var(--fr-danger)" onclick={() => deleteSelected()}><Trash2 size={13} /> Delete segment</button>
					</div>

				{:else if sel?.kind === 'wall' && sel.item}
					{@const wall = sel.item as Wall}
					<div class="fr-card-head">
						<div>
							<div class="fr-card-title">Wall</div>
							<div class="fr-card-sub">{wall.points.length} vertices</div>
						</div>
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => selected = null}><X size={13} /></button>
					</div>
					<div style="padding: 16px; display: flex; flex-direction: column; gap: 14px">
						<div>
							<div class="fr-label" style="display: flex; justify-content: space-between"><span>Thickness</span><strong>{wall.thickness}px</strong></div>
							<input type="range" min={2} max={14} step={1} value={wall.thickness} oninput={(e) => { pushUndo(); updateWalls(ws => ws.map(w => w.id === selected!.id ? { ...w, thickness: +(e.target as HTMLInputElement).value } : w)); }} style="width: 100%" />
						</div>
						<button class="fr-btn" style="color: var(--fr-danger)" onclick={() => deleteSelected()}><Trash2 size={13} /> Delete wall</button>
					</div>

				{:else if sel?.kind === 'door' && sel.item}
					{@const item = sel.item as Door}
					<div class="fr-card-head">
						<div>
							<div class="fr-card-title">Door</div>
							<div class="fr-card-sub">{item.hinge} hinge, swings {item.swing}</div>
						</div>
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => selected = null}><X size={13} /></button>
					</div>
					<div style="padding: 16px; display: flex; flex-direction: column; gap: 14px">
						<div>
							<div class="fr-label">Label</div>
							<input class="fr-input" value={item.label} oninput={(e) => updateDoors(ds => ds.map(d => d.id === item.id ? { ...d, label: (e.target as HTMLInputElement).value } : d))} />
						</div>
						<div>
							<div class="fr-label" style="display: flex; justify-content: space-between"><span>Width</span><strong>{fmtLen(item.width, units)}</strong></div>
							<input type="range" min={60} max={180} step={5} value={item.width} oninput={(e) => updateDoors(ds => ds.map(d => d.id === item.id ? { ...d, width: +(e.target as HTMLInputElement).value } : d))} style="width: 100%" />
						</div>
						<div>
							<div class="fr-label">Hinge side</div>
							<div class="fr-segment" style="width: 100%">
								<button class:active={item.hinge === 'left'} onclick={() => updateDoors(ds => ds.map(d => d.id === item.id ? { ...d, hinge: 'left' as const } : d))} style="flex: 1">Left</button>
								<button class:active={item.hinge === 'right'} onclick={() => updateDoors(ds => ds.map(d => d.id === item.id ? { ...d, hinge: 'right' as const } : d))} style="flex: 1">Right</button>
							</div>
						</div>
						<div>
							<div class="fr-label">Swing</div>
							<div class="fr-segment" style="width: 100%">
								<button class:active={item.swing === 'in'} onclick={() => updateDoors(ds => ds.map(d => d.id === item.id ? { ...d, swing: 'in' as const } : d))} style="flex: 1">Inward</button>
								<button class:active={item.swing === 'out'} onclick={() => updateDoors(ds => ds.map(d => d.id === item.id ? { ...d, swing: 'out' as const } : d))} style="flex: 1">Outward</button>
							</div>
						</div>
						<div>
							<div class="fr-label" style="display: flex; justify-content: space-between"><span>Open angle</span><strong>{item.open}&deg;</strong></div>
							<input type="range" min={30} max={120} step={5} value={item.open} oninput={(e) => updateDoors(ds => ds.map(d => d.id === item.id ? { ...d, open: +(e.target as HTMLInputElement).value } : d))} style="width: 100%" />
						</div>
						<button class="fr-btn" style="color: var(--fr-danger)" onclick={() => deleteSelected()}><Trash2 size={13} /> Delete door</button>
					</div>

				{:else if sel?.kind === 'fixture' && sel.item}
					{@const item = sel.item as Fixture}
					<div class="fr-card-head">
						<div>
							<div class="fr-card-title">Fixture</div>
							<div class="fr-card-sub">{item.kind}</div>
						</div>
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => selected = null}><X size={13} /></button>
					</div>
					<div style="padding: 16px; display: flex; flex-direction: column; gap: 14px">
						<div>
							<div class="fr-label">Label</div>
							<input class="fr-input" value={item.label} oninput={(e) => updateFixtures(fs => fs.map(f => f.id === item.id ? { ...f, label: (e.target as HTMLInputElement).value } : f))} />
						</div>
						<div>
							<div class="fr-label">Type</div>
							<select class="fr-select" value={item.kind} onchange={(e) => updateFixtures(fs => fs.map(f => f.id === item.id ? { ...f, kind: (e.target as HTMLSelectElement).value as Fixture['kind'] } : f))}>
								{#each [['host', 'Host stand'], ['bar', 'Bar'], ['banq', 'Banquette'], ['planter', 'Planter'], ['fire', 'Fireplace'], ['kitchen', 'Service station'], ['restroom', 'Restroom']] as [v, l] (v)}
									<option value={v}>{l}</option>
								{/each}
							</select>
						</div>
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
							<div>
								<div class="fr-label">Width</div>
								<input class="fr-input" type="number" value={item.w} oninput={(e) => updateFixtures(fs => fs.map(f => f.id === item.id ? { ...f, w: +(e.target as HTMLInputElement).value } : f))} />
							</div>
							<div>
								<div class="fr-label">Depth</div>
								<input class="fr-input" type="number" value={item.h} oninput={(e) => updateFixtures(fs => fs.map(f => f.id === item.id ? { ...f, h: +(e.target as HTMLInputElement).value } : f))} />
							</div>
						</div>
						<button class="fr-btn" style="color: var(--fr-danger)" onclick={() => deleteSelected()}><Trash2 size={13} /> Delete</button>
					</div>

				{:else if sel?.kind === 'area' && sel.item}
					{@const item = sel.item as FloorArea}
					<div class="fr-card-head">
						<div>
							<div class="fr-card-title">Area</div>
							<div class="fr-card-sub">{item.name}</div>
						</div>
						<button class="fr-btn fr-btn-sm fr-btn-ghost" onclick={() => selected = null}><X size={13} /></button>
					</div>
					<div style="padding: 16px; display: flex; flex-direction: column; gap: 14px">
						<div>
							<div class="fr-label">Name</div>
							<input class="fr-input" value={item.name} oninput={(e) => updateAreas(as2 => as2.map(a => a.id === item.id ? { ...a, name: (e.target as HTMLInputElement).value } : a))} />
						</div>
						<div>
							<div class="fr-label">Tint</div>
							<select class="fr-select" value={item.tint} onchange={(e) => updateAreas(as2 => as2.map(a => a.id === item.id ? { ...a, tint: (e.target as HTMLSelectElement).value as AreaTint } : a))}>
								{#each ['main', 'bar', 'garden', 'priv'] as t (t)}
									<option value={t}>{t}</option>
								{/each}
							</select>
						</div>
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
							<div>
								<div class="fr-label">Width</div>
								<input class="fr-input" type="number" value={item.w} oninput={(e) => updateAreas(as2 => as2.map(a => a.id === item.id ? { ...a, w: +(e.target as HTMLInputElement).value } : a))} />
							</div>
							<div>
								<div class="fr-label">Height</div>
								<input class="fr-input" type="number" value={item.h} oninput={(e) => updateAreas(as2 => as2.map(a => a.id === item.id ? { ...a, h: +(e.target as HTMLInputElement).value } : a))} />
							</div>
						</div>
						<button class="fr-btn" style="color: var(--fr-danger)" onclick={() => deleteSelected()}><Trash2 size={13} /> Delete area</button>
					</div>
				{/if}
			{:else}
				<!-- No selection: floor properties + instructions -->
				<div class="fr-card-head"><div class="fr-card-title">{activeFloor.name}</div></div>
				<div style="padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem">
					<div>
						<div class="fr-label">Floor name</div>
						<input
							class="fr-input"
							value={activeFloor.name}
							onchange={(e) => {
								const val = (e.target as HTMLInputElement).value.trim();
								if (!val) return;
								pushUndo();
								editFloors = editFloors.map(f => f.id === activeFloorId ? { ...f, name: val } : f);
							}}
						/>
					</div>
					<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem">
						<div>
							<div class="fr-label">Width (m)</div>
							<input class="fr-input" type="number" value={activeFloor.world.w} onchange={(e) => {
								pushUndo();
								editFloors = editFloors.map(f => f.id === activeFloorId ? { ...f, world: { ...f.world, w: +(e.target as HTMLInputElement).value } } : f);
							}} />
						</div>
						<div>
							<div class="fr-label">Height (m)</div>
							<input class="fr-input" type="number" value={activeFloor.world.h} onchange={(e) => {
								pushUndo();
								editFloors = editFloors.map(f => f.id === activeFloorId ? { ...f, world: { ...f.world, h: +(e.target as HTMLInputElement).value } } : f);
							}} />
						</div>
					</div>
					<div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--fr-text-muted)">
						<span>{activeFloor.walls.length} walls · {activeFloor.doors.length} doors · {activeFloor.fixtures.length} fixtures</span>
						<span>{floorTables.length} tables</span>
					</div>
					{#if editFloors.length > 1}
						<button class="fr-btn fr-btn-sm" style="color: var(--fr-danger)" onclick={() => {
							if (!confirm(`Delete "${activeFloor.name}"? This removes all walls, doors, fixtures, and tables on this floor.`)) return;
							deleteFloor(activeFloorId);
						}}><Trash2 size={13} /> Delete floor</button>
					{/if}
					<div style="border-top: 1px solid var(--fr-border); padding-top: 0.625rem">
						<div class="fr-label">Active tool: <strong style="color: var(--fr-text); text-transform: capitalize">{tool}</strong></div>
						<p class="fr-subtle" style="font-size: 0.72rem; line-height: 1.5; margin: 0">
							{#if tool === 'select'}Click to select. Drag walls to move. Double-click midpoints to add vertices.
							{:else if tool === 'wall'}Click points to draw. Click first point to close shape. Right-click or Enter to finish open. Esc cancels.
							{:else if tool === 'door'}Click on a wall to drop a door.
							{:else if tool === 'fixture'}Click to place a fixture.
							{:else if tool === 'area'}Click and drag to draw a zone.
							{/if}
						</p>
					</div>
					<div style="border-top: 1px solid var(--fr-border); padding-top: 0.625rem; font-size: 0.6875rem; color: var(--fr-text-muted); font-family: var(--fr-font-mono)">
						Cmd+Z undo · Cmd+Shift+Z redo · Del delete · arrows nudge
					</div>
				</div>
			{/if}
		</aside>
</div>

<style>
	.se-tool-wrap {
		position: relative;
	}
	.se-tool-tip {
		position: absolute;
		left: calc(100% + 0.625rem);
		top: 50%;
		transform: translateY(-50%);
		white-space: nowrap;
		padding: 0.375rem 0.625rem;
		background: var(--fr-text);
		color: var(--fr-bg);
		border-radius: 0.375rem;
		font-size: 0.75rem;
		line-height: 1.4;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.15s ease;
		box-shadow: 0 2px 8px rgba(0,0,0,0.15);
	}
	.se-tool-tip::before {
		content: '';
		position: absolute;
		right: 100%;
		top: 50%;
		transform: translateY(-50%);
		border: 5px solid transparent;
		border-right-color: var(--fr-text);
	}
	.se-tool-tip strong {
		font-weight: 600;
		font-size: 0.8125rem;
	}
	.se-tool-tip span {
		opacity: 0.7;
		font-size: 0.6875rem;
	}
	.se-tool-wrap:hover .se-tool-tip {
		opacity: 1;
	}
</style>
