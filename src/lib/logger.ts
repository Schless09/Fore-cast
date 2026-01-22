/**
 * Centralized logging utility for better error tracking
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = 
    typeof window !== 'undefined' 
      ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      : process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const formattedMessage = this.formatMessage(level, message, context);

    if (error) {
      const errorContext = {
        ...context,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      };
      const errorMessage = this.formatMessage(level, message, errorContext);

      switch (level) {
        case 'error':
          console.error(errorMessage, error);
          break;
        case 'warn':
          console.warn(errorMessage, error);
          break;
        default:
          console.log(errorMessage, error);
      }
    } else {
      switch (level) {
        case 'error':
          console.error(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'info':
          console.info(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }

    // In production, you might want to send errors to an error tracking service
    if (level === 'error' && !this.isDevelopment) {
      // TODO: Send to error tracking service (e.g., Sentry, LogRocket)
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      this.log('debug', message, context);
    }
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext, error?: Error) {
    this.log('warn', message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error) {
    this.log('error', message, context, error);
  }
}

export const logger = new Logger();

/**
 * Validate environment variables on startup
 */
export function validateEnvVars() {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missing: string[] = [];
  const invalid: string[] = [];

  requiredVars.forEach((varName) => {
    const value = process.env[varName];
    if (!value) {
      missing.push(varName);
    } else if (value.includes('your_') || value.includes('_here')) {
      invalid.push(varName);
    }
  });

  if (missing.length > 0 || invalid.length > 0) {
    const issues = [...missing.map((v) => `${v} is missing`), ...invalid.map((v) => `${v} appears to be a placeholder`)];
    logger.error('Environment variables validation failed', {
      missing,
      invalid,
      issues,
    });
    return {
      valid: false,
      issues,
    };
  }

  logger.info('Environment variables validated successfully');
  return { valid: true, issues: [] };
}
