/**
 * Production-safe logging utility
 * Reduces console noise in production while keeping important errors visible
 */

const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.CONVEX_CLOUD_URL;

export const logger = {
  // Always log errors (critical for production monitoring)
  error: (...args: any[]) => {
    console.error(...args);
  },
  
  // Always log warnings (important for debugging)
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  
  // Only log info in development (reduces production noise)
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  // Only log debug in development
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  // Always log success messages (good for monitoring)
  success: (...args: any[]) => {
    console.log('✅', ...args);
  },
};

// Helper for structured logging with context
export function logWithContext(
  level: 'error' | 'warn' | 'info' | 'debug' | 'success',
  message: string,
  context?: Record<string, any>
) {
  const logMessage = context 
    ? `${message} ${JSON.stringify(context)}`
    : message;
  
  logger[level](logMessage);
}

