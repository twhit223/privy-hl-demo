/**
 * Request throttling utility with exponential backoff for rate limiting
 */

interface ThrottledRequest {
  key: string;
  promise: Promise<any>;
  timestamp: number;
}

// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<any>>();

// Track last request time per endpoint
const lastRequestTime = new Map<string, number>();

// Track consecutive 429 errors for exponential backoff
const consecutiveErrors = new Map<string, number>();

// Minimum delay between requests (ms)
const MIN_REQUEST_DELAY = 1000; // 1 second

// Maximum backoff delay (ms)
const MAX_BACKOFF_DELAY = 30000; // 30 seconds

/**
 * Calculate exponential backoff delay based on consecutive errors
 */
function getBackoffDelay(key: string): number {
  const errors = consecutiveErrors.get(key) || 0;
  if (errors === 0) return 0;
  
  // Exponential backoff: 2^errors seconds, capped at MAX_BACKOFF_DELAY
  const delay = Math.min(Math.pow(2, errors) * 1000, MAX_BACKOFF_DELAY);
  return delay;
}

/**
 * Reset error count on successful request
 */
function resetErrorCount(key: string) {
  consecutiveErrors.delete(key);
}

/**
 * Increment error count on 429 error
 */
function incrementErrorCount(key: string) {
  const current = consecutiveErrors.get(key) || 0;
  consecutiveErrors.set(key, current + 1);
}

/**
 * Throttle API requests to prevent rate limiting
 * 
 * @param key - Unique key for this request type (e.g., 'prices', 'positions')
 * @param requestFn - Function that makes the API request
 * @param minDelay - Minimum delay between requests (default: MIN_REQUEST_DELAY)
 * @returns Promise that resolves with the request result
 */
export async function throttleRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  minDelay: number = MIN_REQUEST_DELAY
): Promise<T> {
  // Check if there's already an in-flight request for this key
  const existingRequest = inFlightRequests.get(key);
  if (existingRequest) {
    return existingRequest as Promise<T>;
  }

  // Calculate delay needed
  const lastTime = lastRequestTime.get(key) || 0;
  const backoffDelay = getBackoffDelay(key);
  const timeSinceLastRequest = Date.now() - lastTime;
  const delayNeeded = Math.max(0, Math.max(minDelay - timeSinceLastRequest, backoffDelay));

  // Wait for delay if needed
  if (delayNeeded > 0) {
    await new Promise(resolve => setTimeout(resolve, delayNeeded));
  }

  // Create the request promise
  const requestPromise = (async () => {
    try {
      lastRequestTime.set(key, Date.now());
      const result = await requestFn();
      resetErrorCount(key);
      return result;
    } catch (error: any) {
      // Handle 429 errors with exponential backoff
      if (error?.status === 429 || 
          error?.message?.includes('429') ||
          error?.message?.includes('Too Many Requests')) {
        incrementErrorCount(key);
        const backoffDelay = getBackoffDelay(key);
        console.warn(`Rate limited (429) for ${key}. Waiting ${backoffDelay}ms before retry...`);
        
        // Wait for backoff delay before throwing
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        // Throw error so caller can handle it
        throw error;
      } else {
        // Reset error count on non-429 errors
        resetErrorCount(key);
        throw error;
      }
    } finally {
      // Remove from in-flight requests after a short delay
      // This allows immediate retries if needed, but prevents duplicate requests
      setTimeout(() => {
        inFlightRequests.delete(key);
      }, minDelay);
    }
  })();

  // Store the in-flight request
  inFlightRequests.set(key, requestPromise);

  return requestPromise;
}

/**
 * Clear all throttling state (useful for testing)
 */
export function clearThrottleState() {
  inFlightRequests.clear();
  lastRequestTime.clear();
  consecutiveErrors.clear();
}
