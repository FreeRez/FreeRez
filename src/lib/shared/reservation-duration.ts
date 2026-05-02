const RESERVATION_DURATION_MINUTES: Record<number, number> = {
	1: 90,
	2: 90,
	3: 120,
	4: 120,
	5: 150,
	6: 150,
};

export function getReservationDuration(partySize: number): number {
	if (partySize <= 6) return RESERVATION_DURATION_MINUTES[partySize] ?? 120;
	return 180;
}
