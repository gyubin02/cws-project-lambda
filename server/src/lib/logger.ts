import pino from 'pino';

const enablePretty =
  process.env['LOG_PRETTY'] === '1' ||
  (process.env['NODE_ENV'] !== 'production' && process.stdout.isTTY);

let logger: ReturnType<typeof pino>;

if (enablePretty) {
  try {
    logger = pino({
      transport: {
        // optional dependency; may not be installed
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          singleLine: false,
        },
      },
    });
  } catch {
    // Fallback if pino-pretty is not installed or cannot be resolved
    logger = pino();
  }
} else {
  logger = pino();
}

export { logger };
