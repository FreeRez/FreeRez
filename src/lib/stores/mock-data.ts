const today = new Date();
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export interface Reservation {
	id: string;
	conf: string;
	time: string;
	date: string;
	party: number;
	guest: string;
	phone: string;
	email: string;
	area: string;
	table: string;
	status: 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no-show';
	server: string;
	origin: string;
	tags: string[];
	note: string;
	spend: number | null;
	exp: { name: string; total: number } | null;
}

export interface Guest {
	id: string;
	name: string;
	email: string;
	phone: string;
	visits: number;
	last: string;
	tags: string[];
	notes: string;
	avgSpend: number;
	optIn: boolean;
}

export interface FloorTable {
	id: string;
	area: string;
	x: number;
	y: number;
	shape: 'round' | 'square' | 'rect';
	seats: number;
	status: 'available' | 'reserved' | 'seated' | 'dirty' | 'blocked' | 'no-show';
}

export interface Review {
	id: string;
	name: string;
	initials: string;
	overall: number;
	food: number;
	service: number;
	ambience: number;
	value: number;
	text: string;
	date: string;
	tags: string[];
	reply: { text: string; author: string } | null;
}

export interface Experience {
	id: string;
	name: string;
	desc: string;
	priceFrom: number;
	priceTo: number;
	prepaid: boolean;
	active: boolean;
	bookings30: number;
}

export interface Shift {
	id: string;
	name: string;
	days: string[];
	start: string;
	end: string;
	interval: number;
	max: number;
	color: 'lunch' | 'dinner' | 'brunch';
}

export const reservations: Reservation[] = [
	{ id: 'r_001', conf: 'FR-7K2M9X', time: '17:30', date: fmt(today), party: 2, guest: 'Eleanor Vance', phone: '+1 415 555 0142', email: 'eleanor.v@hey.com', area: 'Main', table: 'M4', status: 'confirmed', server: 'Marco', origin: 'Web', tags: ['Anniversary', 'VIP'], note: 'Window booth if possible. Prefers still water.', spend: null, exp: null },
	{ id: 'r_002', conf: 'FR-3H8L1Q', time: '17:45', date: fmt(today), party: 4, guest: 'Sasha Okonkwo', phone: '+1 212 555 0987', email: 'sasha.o@gmail.com', area: 'Main', table: 'M7', status: 'confirmed', server: 'Lia', origin: 'Web', tags: ['Birthday'], note: 'Birthday — please bring a candle for dessert.', spend: null, exp: null },
	{ id: 'r_003', conf: 'FR-9P4D2B', time: '18:00', date: fmt(today), party: 2, guest: 'James Kowalski', phone: '+1 718 555 0334', email: 'jkow@outlook.com', area: 'Bar', table: 'B2', status: 'seated', server: 'Marco', origin: 'Phone', tags: [], note: '', spend: 84.50, exp: null },
	{ id: 'r_004', conf: 'FR-2T6N8W', time: '18:00', date: fmt(today), party: 6, guest: 'The Hartley party', phone: '+1 415 555 7711', email: 'd.hartley@hartleyco.com', area: 'Garden', table: 'G1+G2', status: 'confirmed', server: 'Idris', origin: 'Web', tags: ['Corporate'], note: 'Allergies: shellfish (one guest). Vegetarian (two).', spend: null, exp: { name: "Chef's Tasting", total: 540 } },
	{ id: 'r_005', conf: 'FR-5J1R3K', time: '18:15', date: fmt(today), party: 2, guest: 'Mira Chen', phone: '+1 646 555 0220', email: 'mirac@gmail.com', area: 'Main', table: 'M2', status: 'confirmed', server: 'Lia', origin: 'Walk-in', tags: [], note: '', spend: null, exp: null },
	{ id: 'r_006', conf: 'FR-8C4Y7V', time: '18:30', date: fmt(today), party: 3, guest: 'Theo Albright', phone: '+1 415 555 0019', email: 'theo@albright.studio', area: 'Main', table: 'M9', status: 'confirmed', server: 'Marco', origin: 'Web', tags: ['Regular'], note: 'No.7 of 12 visits this year.', spend: null, exp: null },
	{ id: 'r_007', conf: 'FR-1A2S5L', time: '18:45', date: fmt(today), party: 2, guest: 'Priya Raman', phone: '+1 510 555 4400', email: 'priya@raman.io', area: 'Bar', table: 'B5', status: 'seated', server: 'Idris', origin: 'Web', tags: [], note: 'Quiet table preferred.', spend: 120.00, exp: null },
	{ id: 'r_008', conf: 'FR-6E9F0M', time: '19:00', date: fmt(today), party: 8, guest: 'Wilkinson group', phone: '+1 415 555 7720', email: 'wilks.party@gmail.com', area: 'Private', table: 'P1', status: 'confirmed', server: 'Idris', origin: 'Web', tags: ['Private dining'], note: '', spend: null, exp: { name: 'Private Dining', total: 1280 } },
	{ id: 'r_009', conf: 'FR-4G3X8H', time: '19:15', date: fmt(today), party: 2, guest: 'Daniel Park', phone: '+1 415 555 0911', email: 'd.park@parker.tv', area: 'Main', table: 'M5', status: 'confirmed', server: 'Lia', origin: 'Web', tags: [], note: '', spend: null, exp: null },
	{ id: 'r_010', conf: 'FR-2B7N4P', time: '19:30', date: fmt(today), party: 4, guest: 'Aiyana Goldberg', phone: '+1 212 555 7400', email: 'aiyana.g@gmail.com', area: 'Main', table: 'M11', status: 'confirmed', server: 'Marco', origin: 'Web', tags: ['VIP'], note: 'Wine pairing prepped — Burgundy preference.', spend: null, exp: null },
	{ id: 'r_011', conf: 'FR-7Q5W2K', time: '19:45', date: fmt(today), party: 2, guest: 'Lily Fontaine', phone: '+1 415 555 6011', email: 'lily.f@me.com', area: 'Garden', table: 'G3', status: 'confirmed', server: 'Idris', origin: 'Partner', tags: [], note: '', spend: null, exp: null },
	{ id: 'r_012', conf: 'FR-3D8L6V', time: '20:00', date: fmt(today), party: 2, guest: 'Hugo Mendes', phone: '+1 415 555 1140', email: 'hmendes@gmail.com', area: 'Main', table: 'M3', status: 'confirmed', server: 'Lia', origin: 'Web', tags: [], note: '', spend: null, exp: null },
	{ id: 'r_013', conf: 'FR-9K1H7T', time: '20:15', date: fmt(today), party: 5, guest: 'Sayuri Tanaka', phone: '+1 415 555 0033', email: 'sayuri@studio-tk.com', area: 'Main', table: 'M6', status: 'confirmed', server: 'Marco', origin: 'Web', tags: ['Critic'], note: 'James Beard nominee — discreet treatment.', spend: null, exp: null },
	{ id: 'r_014', conf: 'FR-6F2J9R', time: '13:00', date: fmt(today), party: 2, guest: 'Asha Patel', phone: '+1 415 555 0900', email: 'asha@patelco.io', area: 'Main', table: 'M2', status: 'completed', server: 'Lia', origin: 'Web', tags: [], note: '', spend: 92.00, exp: null },
	{ id: 'r_015', conf: 'FR-4M3X2Z', time: '12:30', date: fmt(today), party: 3, guest: 'Rohan Bose', phone: '+1 415 555 4040', email: 'rohan.b@gmail.com', area: 'Main', table: 'M7', status: 'completed', server: 'Marco', origin: 'Web', tags: [], note: '', spend: 145.50, exp: null },
	{ id: 'r_016', conf: 'FR-1Y8Q3F', time: '13:15', date: fmt(today), party: 2, guest: 'Felix Brand', phone: '+1 415 555 5500', email: 'felix@brand.fyi', area: 'Bar', table: 'B1', status: 'no-show', server: '—', origin: 'Web', tags: [], note: '', spend: null, exp: null },
];

export const guests: Guest[] = [
	{ id: 'g_001', name: 'Eleanor Vance', email: 'eleanor.v@hey.com', phone: '+1 415 555 0142', visits: 18, last: '2026-04-02', tags: ['VIP', 'Wine club', 'Burgundy'], notes: 'Anniversary every Apr 28. Husband Marc. Prefers booth M4.', avgSpend: 220, optIn: true },
	{ id: 'g_002', name: 'Sasha Okonkwo', email: 'sasha.o@gmail.com', phone: '+1 212 555 0987', visits: 4, last: '2026-03-20', tags: ['Birthday'], notes: 'Allergic to tree nuts.', avgSpend: 165, optIn: true },
	{ id: 'g_003', name: 'James Kowalski', email: 'jkow@outlook.com', phone: '+1 718 555 0334', visits: 1, last: '2026-04-28', tags: [], notes: '', avgSpend: 85, optIn: false },
	{ id: 'g_004', name: 'Theo Albright', email: 'theo@albright.studio', phone: '+1 415 555 0019', visits: 7, last: '2026-04-12', tags: ['Regular'], notes: 'Local — comes most Sundays.', avgSpend: 95, optIn: true },
	{ id: 'g_005', name: 'Aiyana Goldberg', email: 'aiyana.g@gmail.com', phone: '+1 212 555 7400', visits: 12, last: '2026-04-15', tags: ['VIP', 'Wine club'], notes: 'Burgundy collector. Prefers M11 (banquette).', avgSpend: 310, optIn: true },
	{ id: 'g_006', name: 'Sayuri Tanaka', email: 'sayuri@studio-tk.com', phone: '+1 415 555 0033', visits: 3, last: '2026-03-30', tags: ['Critic', 'Press'], notes: 'James Beard nominee. Reviewing for SF Mag.', avgSpend: 250, optIn: false },
	{ id: 'g_007', name: 'Mira Chen', email: 'mirac@gmail.com', phone: '+1 646 555 0220', visits: 2, last: '2026-04-28', tags: [], notes: '', avgSpend: 110, optIn: true },
	{ id: 'g_008', name: 'Daniel Park', email: 'd.park@parker.tv', phone: '+1 415 555 0911', visits: 5, last: '2026-04-08', tags: ['Industry'], notes: 'Restaurant owner — Parker (Mission).', avgSpend: 175, optIn: true },
	{ id: 'g_009', name: 'Priya Raman', email: 'priya@raman.io', phone: '+1 510 555 4400', visits: 9, last: '2026-04-22', tags: ['Regular'], notes: 'Vegetarian. Quiet seating.', avgSpend: 90, optIn: true },
	{ id: 'g_010', name: 'Lily Fontaine', email: 'lily.f@me.com', phone: '+1 415 555 6011', visits: 1, last: '2026-04-28', tags: [], notes: '', avgSpend: 0, optIn: true },
];

export const tables: FloorTable[] = [
	{ id: 'M1', area: 'Main', x: 12, y: 18, shape: 'round', seats: 2, status: 'available' },
	{ id: 'M2', area: 'Main', x: 22, y: 18, shape: 'round', seats: 2, status: 'reserved' },
	{ id: 'M3', area: 'Main', x: 32, y: 18, shape: 'round', seats: 2, status: 'reserved' },
	{ id: 'M4', area: 'Main', x: 12, y: 35, shape: 'square', seats: 2, status: 'reserved' },
	{ id: 'M5', area: 'Main', x: 22, y: 35, shape: 'square', seats: 2, status: 'reserved' },
	{ id: 'M6', area: 'Main', x: 32, y: 35, shape: 'square', seats: 4, status: 'reserved' },
	{ id: 'M7', area: 'Main', x: 12, y: 55, shape: 'rect', seats: 4, status: 'reserved' },
	{ id: 'M8', area: 'Main', x: 24, y: 55, shape: 'rect', seats: 4, status: 'available' },
	{ id: 'M9', area: 'Main', x: 36, y: 55, shape: 'rect', seats: 4, status: 'reserved' },
	{ id: 'M10', area: 'Main', x: 12, y: 75, shape: 'round', seats: 2, status: 'available' },
	{ id: 'M11', area: 'Main', x: 24, y: 75, shape: 'rect', seats: 6, status: 'reserved' },
	{ id: 'M12', area: 'Main', x: 38, y: 75, shape: 'round', seats: 2, status: 'dirty' },
	{ id: 'B1', area: 'Bar', x: 56, y: 18, shape: 'round', seats: 2, status: 'no-show' },
	{ id: 'B2', area: 'Bar', x: 64, y: 18, shape: 'round', seats: 2, status: 'seated' },
	{ id: 'B3', area: 'Bar', x: 72, y: 18, shape: 'round', seats: 2, status: 'available' },
	{ id: 'B4', area: 'Bar', x: 56, y: 32, shape: 'round', seats: 2, status: 'available' },
	{ id: 'B5', area: 'Bar', x: 64, y: 32, shape: 'round', seats: 2, status: 'seated' },
	{ id: 'B6', area: 'Bar', x: 72, y: 32, shape: 'round', seats: 2, status: 'available' },
	{ id: 'G1', area: 'Garden', x: 56, y: 55, shape: 'rect', seats: 6, status: 'reserved' },
	{ id: 'G2', area: 'Garden', x: 70, y: 55, shape: 'rect', seats: 6, status: 'reserved' },
	{ id: 'G3', area: 'Garden', x: 56, y: 75, shape: 'round', seats: 4, status: 'reserved' },
	{ id: 'G4', area: 'Garden', x: 70, y: 75, shape: 'round', seats: 4, status: 'available' },
	{ id: 'P1', area: 'Private', x: 86, y: 35, shape: 'rect', seats: 12, status: 'reserved' },
	{ id: 'P2', area: 'Private', x: 86, y: 70, shape: 'rect', seats: 8, status: 'blocked' },
];

export const reviews: Review[] = [
	{ id: 'rv_1', name: 'Eleanor V.', initials: 'EV', overall: 5, food: 5, service: 5, ambience: 5, value: 4, text: 'Eighteen visits in and Marco still remembers our anniversary. The new Burgundy list is exceptional.', date: '2026-04-02', tags: ['Romantic', 'Special occasion'], reply: { text: 'Thank you Eleanor — see you in May.', author: 'Tomás, GM' } },
	{ id: 'rv_2', name: 'Aiyana G.', initials: 'AG', overall: 5, food: 5, service: 5, ambience: 4, value: 4, text: 'The tasting menu paired with the 2018 Volnay was the highlight of my week. Service from Lia was effortless.', date: '2026-04-15', tags: ['Wine'], reply: null },
	{ id: 'rv_3', name: 'Marco P.', initials: 'MP', overall: 4, food: 5, service: 4, ambience: 4, value: 3, text: "Food is genuinely some of the best in the city. Slightly noisy on Saturdays but that's the price of being good.", date: '2026-04-10', tags: ['Food', 'Lively'], reply: null },
	{ id: 'rv_4', name: 'Naomi K.', initials: 'NK', overall: 3, food: 4, service: 2, ambience: 4, value: 3, text: 'Long wait for our table even with a reservation. The food when it arrived was lovely but the wait soured the night.', date: '2026-04-08', tags: [], reply: { text: "Naomi, our apologies — that Saturday we ran behind. We'd love to host you again on us.", author: 'Tomás, GM' } },
	{ id: 'rv_5', name: 'Theo A.', initials: 'TA', overall: 5, food: 5, service: 5, ambience: 5, value: 5, text: 'My local. Always treated like family. Sunday lunch is a ritual now.', date: '2026-04-12', tags: ['Regular'], reply: null },
];

export const experiences: Experience[] = [
	{ id: 'e_1', name: "Chef's Tasting Menu", desc: '7-course seasonal tasting — duck, line-caught halibut, aged dairy.', priceFrom: 95, priceTo: 145, prepaid: true, active: true, bookings30: 142 },
	{ id: 'e_2', name: 'Wine Pairing Add-on', desc: '5 glasses paired to the tasting. Sommelier-led.', priceFrom: 65, priceTo: 120, prepaid: false, active: true, bookings30: 98 },
	{ id: 'e_3', name: 'Private Dining — Cellar', desc: 'Up to 14 guests. Custom menu, dedicated server, AV available.', priceFrom: 160, priceTo: 240, prepaid: true, active: true, bookings30: 8 },
	{ id: 'e_4', name: 'Sunday Burgundy Lunch', desc: '4-course lunch + bottle of producer-selected Burgundy.', priceFrom: 110, priceTo: 110, prepaid: false, active: true, bookings30: 36 },
	{ id: 'e_5', name: "New Year's Eve Gala", desc: 'One night. Five courses. Champagne midnight pour.', priceFrom: 285, priceTo: 285, prepaid: true, active: false, bookings30: 0 },
];

export const shifts: Shift[] = [
	{ id: 's_1', name: 'Lunch', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '11:30', end: '14:30', interval: 15, max: 28, color: 'lunch' },
	{ id: 's_2', name: 'Dinner', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Sun'], start: '17:00', end: '22:00', interval: 15, max: 60, color: 'dinner' },
	{ id: 's_3', name: 'Dinner — late', days: ['Fri', 'Sat'], start: '17:00', end: '23:00', interval: 15, max: 72, color: 'dinner' },
	{ id: 's_4', name: 'Brunch', days: ['Sat', 'Sun'], start: '10:00', end: '14:00', interval: 30, max: 40, color: 'brunch' },
];
