/**
 * Logger Service
 * Simple logging utility for application events
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage('debug', message), data || '');
    }
  }

  info(message: string, data?: any): void {
    console.info(this.formatMessage('info', message), data || '');
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage('warn', message), data || '');
  }

  error(message: string, error?: any): void {
    console.error(this.formatMessage('error', message), error || '');
  }
}

export const logger = new Logger();
