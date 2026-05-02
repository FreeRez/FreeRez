import type { RequestHandler } from './$types';
import { getAuthContext, apiError, apiSuccess, requireAuthorizedRid, parseIntParam } from '$api/helpers';
import { calculateAvailability } from '$api/availability-engine';

export const GET: RequestHandler = async (event) => {
	const ridResult = requireAuthorizedRid(event);
	if (ridResult instanceof Response) return ridResult;
	const rid = ridResult;
	const auth = getAuthContext(event)!;

	const { url, locals } = event;
	const db = locals.db;

	const startDateTime = url.searchParams.get('start_date_time');
	if (!startDateTime) return apiError('start_date_time is required', 400);

	const forwardMinutes = parseIntParam(url.searchParams.get('forward_minutes'), 120);
	const backwardMinutes = parseIntParam(url.searchParams.get('backward_minutes'), 0);
	const partySize = parseIntParam(url.searchParams.get('party_size'), 2);
	const includeExperiences = url.searchParams.get('include_experiences') === 'true';

	const result = await calculateAvailability({
		db,
		restaurantId: '',
		rid,
		startDateTime,
		forwardMinutes,
		backwardMinutes,
		partySize,
		includeExperiences
	});
	if (!result) return apiError('Restaurant not found', 404);

	// Build table_type arrays per dining area from slot data
	const tableTypesByArea = new Map<number, Set<string>>();
	for (const area of result.areas) {
		const types = new Set<string>();
		types.add('default');
		if (area.environment === 'Outdoor') {
			types.add('outdoor');
		}
		tableTypesByArea.set(area.areaId, types);
	}

	const times: string[] = [];
	const timesAvailable: Array<{
		time: string;
		availability_types: Array<{
			type: string;
			diningArea: Array<{
				id: number;
				table_type: string[];
				experience_ids?: number[];
			}>;
			experienceCancellationPolicy?: Array<{
				experienceId: number;
				type: string;
				id: string;
			}>;
		}>;
	}> = [];

	for (const slot of result.slots) {
		if (!slot.canSeatParty) continue;

		const timeStr = slot.time;
		times.push(timeStr);

		const availabilityTypes: Array<{
			type: string;
			diningArea: Array<{
				id: number;
				table_type: string[];
				experience_ids?: number[];
			}>;
			experienceCancellationPolicy?: Array<{
				experienceId: number;
				type: string;
				id: string;
			}>;
		}> = [];

		// Standard type
		const standardDiningAreas = result.areas.map((a) => ({
			id: a.areaId,
			table_type: Array.from(tableTypesByArea.get(a.areaId) ?? ['default'])
		}));

		availabilityTypes.push({
			type: 'Standard',
			diningArea: standardDiningAreas
		});

		// Experience type (if requested and experiences exist)
		if (includeExperiences && result.activeExperiences.length > 0) {
			const experienceIds = result.activeExperiences.map((e) => e.experienceId);
			const experienceDiningAreas: Array<{
				id: number;
				table_type: string[];
				experience_ids: number[];
			}> = [];

			for (const area of result.areas) {
				const areaTableTypes = Array.from(tableTypesByArea.get(area.areaId) ?? ['default']);
				for (const tableType of areaTableTypes) {
					experienceDiningAreas.push({
						id: area.areaId,
						table_type: [tableType],
						experience_ids: experienceIds
					});
				}
			}

			const experienceCancellationPolicy = result.activeExperiences.map((e) => ({
				experienceId: e.experienceId,
				type: 'Hold',
				id: `${e.id}:v${e.version}`
			}));

			availabilityTypes.push({
				type: 'Experience',
				diningArea: experienceDiningAreas,
				experienceCancellationPolicy
			});
		}

		timesAvailable.push({
			time: timeStr,
			availability_types: availabilityTypes
		});
	}

	return apiSuccess({
		rid,
		party_size: partySize,
		restaurant_settings: {
			scc_enabled: true
		},
		times,
		times_available: timesAvailable
	});
};
