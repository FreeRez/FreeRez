type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
};

let minLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
	minLevel = level;
}

export function log(
	level: LogLevel,
	event: string,
	data?: Record<string, unknown>
): void {
	if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) return;

	const entry = {
		timestamp: new Date().toISOString(),
		level,
		event,
		...data
	};

	switch (level) {
		case 'error':
			console.error(JSON.stringify(entry));
			break;
		case 'warn':
			console.warn(JSON.stringify(entry));
			break;
		default:
			console.log(JSON.stringify(entry));
	}
}
