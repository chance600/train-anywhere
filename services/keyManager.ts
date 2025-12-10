import { GEMINI_API_KEY as ENV_KEY } from '../constants';

const STORAGE_KEY = 'user_gemini_api_key';

export const KeyManager = {
    /**
     * Returns the best available API Key.
     * Priority: LocalStorage > Environment Variable
     */
    getKey: (): string => {
        const storedKey = localStorage.getItem(STORAGE_KEY);
        if (storedKey) return storedKey;
        return ENV_KEY;
    },

    /**
     * Saves a user-provided API key to LocalStorage.
     */
    saveKey: (key: string) => {
        localStorage.setItem(STORAGE_KEY, key.trim());
    },

    /**
     * Removes the user-provided API key from LocalStorage.
     */
    removeKey: () => {
        localStorage.removeItem(STORAGE_KEY);
    },

    /**
     * Checks if a valid key exists (either env or stored).
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
    }
};
