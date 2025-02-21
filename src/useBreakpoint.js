import { useEffect, useState } from "react";
import tailwindConfig from "src/../tailwind.config";
import resolveConfig from "tailwindcss/resolveConfig";

const config = resolveConfig(tailwindConfig);

export const useIsBreakpointActive = (breakpoint) => {
    // Get width of requested breakpoint from tailwind config
    const width = config.theme.screens[breakpoint];
    const widthPx = parseInt(width);

    const [isBreakpointActive, setIsBreakpointActive] = useState(
        window.innerWidth >= widthPx
    );

    // Update when window resized
    useEffect(() => {
        const handleResize = () => {
            setIsBreakpointActive(window.innerWidth >= widthPx);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return isBreakpointActive;
};
