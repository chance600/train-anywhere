import { GEMINI_API_KEY as ENV_KEY, SUPABASE_URL } from '../constants';

const STORAGE_KEY = 'user_gemini_api_key';

// In-memory cache for session key (from backend)
let cachedSessionKey: string | null = null;

export const KeyManager = {
    /**
     * Returns the best available API Key.
     * Priority: LocalStorage (BYO) > In-Memory Session Cache > (Async Fetch)
     * This is a SYNC version for quick checks. Use getKeyAsync for full flow.
     */
    getKey: (): string => {
        const storedKey = localStorage.getItem(STORAGE_KEY);
        if (storedKey) return storedKey;
        if (cachedSessionKey) return cachedSessionKey;
        // Fallback to env key ONLY if explicitly set (dev mode)
        return ENV_KEY;
    },

    /**
     * Asynchronously fetches a key from the backend if no local key is set.
     * This is the secure path for authenticated users.
     */
    getKeyAsync: async (accessToken: string): Promise<string | null> => {
        // 1. Check BYO Key first
        const storedKey = localStorage.getItem(STORAGE_KEY);
        if (storedKey) return storedKey;

        // 2. Check in-memory cache
        if (cachedSessionKey) return cachedSessionKey;

        // 3. Fetch from secure backend
        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/request-session-access`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                console.error("Failed to get session key:", await response.text());
                return null;
            }

            const data = await response.json();
            if (data.apiKey) {
                cachedSessionKey = data.apiKey;
                return cachedSessionKey;
            }
            return null;
        } catch (error) {
            console.error("Error fetching session key:", error);
            return null;
        }
    },

    /**
     * Saves a user-provided API key to LocalStorage.
     */
    saveKey: (key: string) => {
        localStorage.setItem(STORAGE_KEY, key.trim());
        cachedSessionKey = null; // Clear any session key if user provides their own
    },

    /**
     * Removes the user-provided API key from LocalStorage.
     */
    removeKey: () => {
        localStorage.removeItem(STORAGE_KEY);
        cachedSessionKey = null;
    },

    /**
     * Checks if a valid key exists (either user-provided, cached, or env).
     */
    hasKey: (): boolean => {
        const key = KeyManager.getKey();
        return !!key && key.length > 0;
    },

    /**
     * Returns true if the current key is User Provided (LocalStorage).
     * Useful for UI states.
     */
    isUserKey: (): boolean => {
        return !!localStorage.getItem(STORAGE_KEY);
    },

    /**
     * Clears the in-memory session cache (e.g., on logout).
     */
    clearSessionCache: () => {
        cachedSessionKey = null;
    }
};
