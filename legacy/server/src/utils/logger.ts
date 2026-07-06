import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFile = process.env.LOG_FILE || 'logs/app.log';
const isDevelopment = process.env.NODE_ENV === 'development';

const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  }),
);

const transports: winston.transport[] = [];

// Console transport for development
if (isDevelopment) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: logLevel,
    }),
  );
}

// File transport for production
if (!isDevelopment) {
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), logFile),
      format: customFormat,
      level: logLevel,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  );
}

// Error file transport
transports.push(
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    format: customFormat,
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
);

export const logger = winston.createLogger({
  level: logLevel,
  format: customFormat,
  transports,
  exitOnError: false,
});

// Stream for HTTP request logging
export const httpLogStream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};