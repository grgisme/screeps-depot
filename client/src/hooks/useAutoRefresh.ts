import { useEffect, useRef } from "react";

const AUTO_REFRESH_MS = 60_000; // 60 seconds

/**
 * Calls `callback` on a repeating interval (default 60 s).
 * Does NOT fire on mount — pair with your existing useEffect for initial load.
 * The interval resets whenever `callback` identity changes (i.e. when deps change).
 */
export function useAutoRefresh(callback: () => void) {
    const savedCallback = useRef(callback);

    // Keep the ref current so the interval always calls the latest closure
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        const id = setInterval(() => savedCallback.current(), AUTO_REFRESH_MS);
        return () => clearInterval(id);
    }, []);
}
