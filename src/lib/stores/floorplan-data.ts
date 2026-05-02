// Floor plan geometry — SVG world is 1400 x 900 (units = "cm" of restaurant floor)
// Walls, dividers, fixtures, and tables with explicit positions, rotations, dimensions.
// Tables are rect (w x h) with seats placed automatically along the longer sides;
// round tables get seats around perimeter.

export interface Point {
	x: number;
	y: number;
}

export interface Wall {
	id: string;
	closed: boolean;
	thickness: number;
	points: Point[];
}

export interface Opening {
	x: number;
	y: number;
	w: number;
	h: number;
	label?: string;
}

export interface Fixture {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	label: string;
	kind: 'host' | 'bar' | 'banq' | 'planter' | 'fire' | 'kitchen' | 'restroom';
}

export type TableStatus = 'available' | 'reserved' | 'seated' | 'dirty' | 'blocked' | 'no-show';

export interface FloorTable {
	id: string;
	area: string;
	floorId: string;
	shape: 'round' | 'rect';
	x: number;
	y: number;
	d?: number;
	w?: number;
	h?: number;
	rot: number;
	seats: number;
	status: TableStatus;
}

export interface Door {
	id: string;
	x: number;
	y: number;
	wallAngle: number;
	width: number;
	hinge: 'left' | 'right';
	swing: 'in' | 'out';
	open: number;
	label: string;
	wallId?: string;
	segIndex?: number;
	t?: number;
}

export type AreaTint = 'main' | 'bar' | 'garden' | 'priv';

export interface FloorArea {
	id: string;
	name: string;
	x: number;
	y: number;
	w: number;
	h: number;
	tint: AreaTint;
}

export interface Floor {
	id: string;
	name: string;
	ordinal: number;
	walls: Wall[];
	doors: Door[];
	fixtures: Fixture[];
	areas: FloorArea[];
	world: { w: number; h: number };
}

export interface FloorPlanData {
	floors: Floor[];
	tables: FloorTable[];
}

export const floorPlanData: FloorPlanData = {
	floors: [
		{
			id: 'floor-1',
			name: 'Ground Floor',
			ordinal: 0,
			walls: [
				// Outer building shell (closed)
				{
					id: 'shell',
					closed: true,
					thickness: 10,
					points: [
						{ x: 40, y: 60 },
						{ x: 1360, y: 60 },
						{ x: 1360, y: 840 },
						{ x: 880, y: 840 },
						{ x: 880, y: 720 },
						{ x: 760, y: 720 },
						{ x: 760, y: 840 },
						{ x: 40, y: 840 }
					]
				},
				// Vertical divider between Main and Bar/Garden zones
				{ id: 'div1', closed: false, thickness: 6, points: [{ x: 720, y: 60 }, { x: 720, y: 460 }] },
				// Horizontal half-wall separating Bar (top) from Garden (bottom) on right side
				{ id: 'div2', closed: false, thickness: 5, points: [{ x: 720, y: 460 }, { x: 1100, y: 460 }] },
				// Private dining room walls
				{ id: 'priv-l', closed: false, thickness: 6, points: [{ x: 1100, y: 60 }, { x: 1100, y: 840 }] }
			],
			doors: [
				{ id: 'd-entrance', x: 60, y: 840, wallAngle: 0, width: 90, hinge: 'left', swing: 'in', open: 90, label: 'Entrance' },
				{ id: 'd-kitchen', x: 770, y: 60, wallAngle: 0, width: 80, hinge: 'left', swing: 'out', open: 90, label: 'Kitchen' },
				{ id: 'd-bar', x: 720, y: 200, wallAngle: 90, width: 60, hinge: 'left', swing: 'in', open: 90, label: '' },
				{ id: 'd-priv', x: 1100, y: 380, wallAngle: 90, width: 60, hinge: 'left', swing: 'in', open: 80, label: 'Private' }
			],
			fixtures: [
				{ id: 'host', x: 80, y: 760, w: 110, h: 50, label: 'Host stand', kind: 'host' },
				{ id: 'bar', x: 760, y: 110, w: 320, h: 60, label: 'Bar', kind: 'bar' },
				{ id: 'banq', x: 60, y: 100, w: 12, h: 240, label: '', kind: 'banq' },
				{ id: 'banq2', x: 60, y: 380, w: 12, h: 220, label: '', kind: 'banq' },
				{ id: 'planter', x: 1140, y: 500, w: 50, h: 50, label: '', kind: 'planter' },
				{ id: 'fireplace', x: 380, y: 70, w: 80, h: 14, label: 'Fireplace', kind: 'fire' }
			],
			areas: [
				{ id: 'a-main', name: 'Main dining', x: 50, y: 70, w: 660, h: 760, tint: 'main' },
				{ id: 'a-bar', name: 'Bar', x: 730, y: 70, w: 360, h: 380, tint: 'bar' },
				{ id: 'a-garden', name: 'Garden Terrace', x: 730, y: 470, w: 360, h: 240, tint: 'garden' },
				{ id: 'a-priv', name: 'Private dining', x: 1110, y: 70, w: 240, h: 760, tint: 'priv' }
			],
			world: { w: 1400, h: 900 }
		},
		{
			id: 'floor-2',
			name: 'Rooftop',
			ordinal: 1,
			walls: [],
			doors: [],
			fixtures: [],
			areas: [],
			world: { w: 1400, h: 600 }
		}
	],

	tables: [
		// Main dining (left)
		{ id: 'M1', area: 'Main', floorId: 'floor-1', shape: 'round', x: 130, y: 140, d: 80, seats: 2, rot: 0, status: 'available' },
		{ id: 'M2', area: 'Main', floorId: 'floor-1', shape: 'round', x: 250, y: 140, d: 80, seats: 2, rot: 0, status: 'reserved' },
		{ id: 'M3', area: 'Main', floorId: 'floor-1', shape: 'round', x: 370, y: 140, d: 80, seats: 2, rot: 0, status: 'reserved' },
		{ id: 'M4', area: 'Main', floorId: 'floor-1', shape: 'rect', x: 130, y: 260, w: 90, h: 90, rot: 0, seats: 2, status: 'reserved' },
		{ id: 'M5', area: 'Main', floorId: 'floor-1', shape: 'rect', x: 250, y: 260, w: 90, h: 90, rot: 0, seats: 2, status: 'reserved' },
		{ id: 'M6', area: 'Main', floorId: 'floor-1', shape: 'rect', x: 370, y: 260, w: 110, h: 90, rot: 0, seats: 4, status: 'reserved' },
		{ id: 'M7', area: 'Main', floorId: 'floor-1', shape: 'rect', x: 130, y: 420, w: 160, h: 90, rot: 0, seats: 4, status: 'reserved' },
		{ id: 'M8', area: 'Main', floorId: 'floor-1', shape: 'rect', x: 320, y: 420, w: 160, h: 90, rot: 0, seats: 4, status: 'available' },
		{ id: 'M9', area: 'Main', floorId: 'floor-1', shape: 'rect', x: 510, y: 420, w: 160, h: 90, rot: 0, seats: 4, status: 'reserved' },
		{ id: 'M10', area: 'Main', floorId: 'floor-1', shape: 'round', x: 140, y: 620, d: 80, seats: 2, rot: 0, status: 'available' },
		{ id: 'M11', area: 'Main', floorId: 'floor-1', shape: 'rect', x: 290, y: 600, w: 200, h: 90, rot: 0, seats: 6, status: 'reserved' },
		{ id: 'M12', area: 'Main', floorId: 'floor-1', shape: 'round', x: 580, y: 620, d: 80, seats: 2, rot: 0, status: 'dirty' },

		// Bar (top right)
		{ id: 'B1', area: 'Bar', floorId: 'floor-1', shape: 'round', x: 800, y: 220, d: 60, seats: 2, rot: 0, status: 'no-show' },
		{ id: 'B2', area: 'Bar', floorId: 'floor-1', shape: 'round', x: 880, y: 220, d: 60, seats: 2, rot: 0, status: 'seated' },
		{ id: 'B3', area: 'Bar', floorId: 'floor-1', shape: 'round', x: 960, y: 220, d: 60, seats: 2, rot: 0, status: 'available' },
		{ id: 'B4', area: 'Bar', floorId: 'floor-1', shape: 'round', x: 1040, y: 220, d: 60, seats: 2, rot: 0, status: 'available' },
		{ id: 'B5', area: 'Bar', floorId: 'floor-1', shape: 'round', x: 800, y: 340, d: 60, seats: 2, rot: 0, status: 'seated' },
		{ id: 'B6', area: 'Bar', floorId: 'floor-1', shape: 'round', x: 880, y: 340, d: 60, seats: 2, rot: 0, status: 'available' },

		// Garden (bottom right)
		{ id: 'G1', area: 'Garden', floorId: 'floor-1', shape: 'rect', x: 770, y: 530, w: 120, h: 80, rot: 0, seats: 4, status: 'reserved' },
		{ id: 'G2', area: 'Garden', floorId: 'floor-1', shape: 'rect', x: 920, y: 530, w: 120, h: 80, rot: 0, seats: 4, status: 'reserved' },
		{ id: 'G3', area: 'Garden', floorId: 'floor-1', shape: 'round', x: 800, y: 690, d: 80, seats: 4, rot: 0, status: 'reserved' },
		{ id: 'G4', area: 'Garden', floorId: 'floor-1', shape: 'round', x: 940, y: 690, d: 80, seats: 4, rot: 0, status: 'available' },

		// Private dining (far right)
		{ id: 'P1', area: 'Private', floorId: 'floor-1', shape: 'rect', x: 1140, y: 130, w: 200, h: 130, rot: 0, seats: 8, status: 'reserved' },
		{ id: 'P2', area: 'Private', floorId: 'floor-1', shape: 'rect', x: 1140, y: 320, w: 200, h: 90, rot: 0, seats: 6, status: 'blocked' }
	]
};
