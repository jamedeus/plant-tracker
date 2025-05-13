import { useEffect, useState } from "react";
import defaultTheme from 'tailwindcss/defaultTheme';

export const useIsBreakpointActive = (breakpoint) => {
    // Get width of requested breakpoint from tailwind config
    const width = defaultTheme.screens[breakpoint];
    const mediaQuery = `(min-width: ${width})`;

    const [isBreakpointActive, setIsBreakpointActive] = useState(
        () => window.matchMedia(mediaQuery).matches
    );

    // Update when window resized
    useEffect(() => {
        const handleResize = () => {
            setIsBreakpointActive(() => window.matchMedia(mediaQuery).matches);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return isBreakpointActive;
};
