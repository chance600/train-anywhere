/**
 * Utility for network operations with retry logic
 */

interface RetryOptions {
    maxRetries?: number;
    delayMs?: number;
    backoff?: boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
    maxRetries: 3,
    delayMs: 1000,
    backoff: true
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const { maxRetries, delayMs, backoff } = { ...DEFAULT_OPTIONS, ...options };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= (maxRetries || 3); attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt < (maxRetries || 3)) {
                const delay = backoff ? (delayMs || 1000) * Math.pow(2, attempt) : (delayMs || 1000);
                console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

/**
 * Safely parse JSON with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
    try {
        return JSON.parse(json);
    } catch {
        return fallback;
    }
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate numeric input within range
 */
export function isValidNumber(value: unknown, min?: number, max?: number): boolean {
    if (typeof value !== 'number' || isNaN(value)) return false;
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
    return true;
}

/**
 * Rate limiter for client-side protection
 */
export class RateLimiter {
    private timestamps: number[] = [];
    private readonly limit: number;
    private readonly windowMs: number;

    constructor(limit: number, windowMs: number) {
        this.limit = limit;
        this.windowMs = windowMs;
    }

    canProceed(): boolean {
        const now = Date.now();
        this.timestamps = this.timestamps.filter(ts => now - ts < this.windowMs);

        if (this.timestamps.length >= this.limit) {
            return false;
        }

        this.timestamps.push(now);
        return true;
    }

    reset(): void {
        this.timestamps = [];
    }
}
