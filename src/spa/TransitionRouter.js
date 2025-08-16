import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Routes from './routes';
import {
    OverviewApp,
    ManagePlantApp,
    ManageGroupApp,
    RegisterApp,
    UserProfileApp,
    PermissionDeniedApp,
} from './bundles';

const PrefetchContext = createContext({
    getPrefetched: () => null,
    refresh: async () => null,
});

export function usePrefetchedState() {
    const { getPrefetched } = useContext(PrefetchContext);
    const location = useLocation();
    return getPrefetched(location.pathname);
}

function matchRoute(pathname) {
    if (pathname === '/') {
        return { key: 'overview', params: {} };
    }
    if (pathname === '/archived') {
        return { key: 'archived', params: {} };
    }
    if (pathname === '/accounts/profile/') {
        return { key: 'user_profile', params: {} };
    }
    const manageMatch = pathname.match(/^\/manage\/([0-9a-fA-F-]{36})$/);
    if (manageMatch) {
        return { key: 'manage', params: { uuid: manageMatch[1] } };
    }
    // Non-prefetched routes (accounts, etc.)
    return { key: null, params: {} };
}

async function fetchForRoute(route) {
    switch (route.key) {
        case 'overview': {
            await OverviewApp.preload();
            const response = await fetch('/get_overview_state');
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                if (response.redirected) {
                    window.location.href = response.url || '/get_overview_state';
                    return { redirected: true };
                }
            }
            const data = contentType.includes('application/json') ? await response.json() : null;
            if (!response.ok) {
                const error = data?.error || `Request failed (${response.status})`;
                return { error, status: response.status };
            }
            return { data, status: response.status };
        }
        case 'archived': {
            await OverviewApp.preload();
            const response = await fetch('/get_archived_overview_state');
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                if (response.redirected) {
                    window.location.href = response.url || '/get_archived_overview_state';
                    return { redirected: true };
                }
            }
            const data = contentType.includes('application/json') ? await response.json() : null;
            if (!response.ok) {
                const error = data?.error || `Request failed (${response.status})`;
                return { error, status: response.status };
            }
            return { data, status: response.status };
        }
        case 'manage': {
            const response = await fetch(`/resolve_manage/${route.params.uuid}`);
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                if (response.redirected) {
                    window.location.href = response.url || `/resolve_manage/${route.params.uuid}`;
                    return { redirected: true };
                }
            }
            const data = contentType.includes('application/json') ? await response.json() : null;
            if (response.status === 403) {
                const error = data?.state?.error || data?.error || 'You do not have permission to view this page';
                return { denied: true, error, status: response.status };
            }
            if (!response.ok) {
                const error = data?.error || `Request failed (${response.status})`;
                return { error, status: response.status };
            }
            // Preload the target page bundle to avoid suspense flash
            if (data.page === 'manage_plant') await ManagePlantApp.preload();
            else if (data.page === 'manage_group') await ManageGroupApp.preload();
            else if (data.page === 'register') await RegisterApp.preload();
            return { data, status: response.status };
        }
        case 'user_profile': {
            await UserProfileApp.preload();
            const response = await fetch('/accounts/get_user_details/');
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                if (response.redirected) {
                    window.location.href = response.url || '/accounts/profile/';
                    return { redirected: true };
                }
            }
            if (response.status === 403) {
                // Single-user mode or not authenticated
                const payload = contentType.includes('application/json') ? await response.json() : null;
                const error = payload?.error || 'You do not have permission to view this page';
                return { denied: true, error, status: response.status };
            }
            const payload = contentType.includes('application/json') ? await response.json() : null;
            if (!response.ok) {
                const error = payload?.error || `Request failed (${response.status})`;
                return { error, status: response.status };
            }
            return { data: payload, status: response.status };
        }
        default:
            return { data: null, status: 200 };
    }
}

export default function TransitionRouter() {
    const location = useLocation();
    const pendingLocationRef = useRef(null);
    const [displayLocation, setDisplayLocation] = useState(null);
    const [permissionDeniedMessage, setPermissionDeniedMessage] = useState(null);
    const prefetchedRef = useRef(new Map());

    // Force re-render so adapters see new data
    const [version, setVersion] = useState(0);

    const getPrefetched = useCallback((pathname) => {
        return prefetchedRef.current.get(pathname) || null;
    }, []);

    const prefetchAndCommit = useCallback(async (nextLocation) => {
        const pathname = nextLocation.pathname;
        setPermissionDeniedMessage(null);
        const route = matchRoute(pathname);
        // For non-prefetched routes, switch immediately
        if (!route.key) {
            setDisplayLocation(nextLocation);
            return;
        }
        const result = await fetchForRoute(route);
        if (result?.denied) {
            // Override template title
            document.title = 'Permission Denied';
            setPermissionDeniedMessage(result.error || 'You do not have permission to view this page');
            return;
        }
        if (result?.redirected) {
            return;
        }
        if (result?.error && route.key !== 'manage') {
            // Show generic error using permission denied view for now
            setPermissionDeniedMessage(result.error);
            return;
        }
        // Manage: set title from response ("Manage Plant", "Manage Group", etc)
        if (route.key === 'manage' && result?.data?.title) {
            document.title = result.data.title;
        }
        prefetchedRef.current.set(pathname, { route, ...result });
        setDisplayLocation(nextLocation);
    }, []);

    const refresh = useCallback(async (pathname) => {
        const targetPath = pathname || location.pathname;
        const route = matchRoute(targetPath);
        if (!route.key) return { ok: false, reason: 'not-prefetchable' };

        const result = await fetchForRoute(route);
        if (result?.denied || result?.redirected || result?.error) {
            return { ok: false, result };
        }
        // Manage: set title from response ("Manage Plant", "Manage Group", etc)
        if (route.key === 'manage' && result?.data?.title) {
            document.title = result.data.title;
        }
        // Update prefetched state, bump version to force re-render
        prefetchedRef.current.set(targetPath, { route, ...result });
        setVersion((v) => v + 1);
        return { ok: true, result };
    }, [location.pathname]);

    // First paint: prefetch current route and render nothing until ready
    useEffect(() => {
        if (displayLocation !== null) return;
        pendingLocationRef.current = location;
        prefetchAndCommit(location);
    }, [displayLocation, location, prefetchAndCommit]);

    // On navigation: prefetch next route and only then swap
    useEffect(() => {
        if (displayLocation === null) return; // initial load handled above
        if (location.pathname === displayLocation.pathname) return;
        pendingLocationRef.current = location;
        prefetchAndCommit(location);
    }, [location, displayLocation, prefetchAndCommit]);

    const contextValue = useMemo(() => (
        { getPrefetched, refresh, version }
    ), [getPrefetched, refresh, version]);

    // Render nothing on first load until ready, unless permission denied
    if (displayLocation === null) {
        if (permissionDeniedMessage) {
            return (
                <React.Suspense fallback={null}>
                    <PermissionDeniedApp errorMessage={permissionDeniedMessage} />
                </React.Suspense>
            );
        }
        return null;
    }

    return (
        <PrefetchContext.Provider value={contextValue}>
            {/* When permission denied, render message and hide route content */}
            {permissionDeniedMessage ? (
                <React.Suspense fallback={null}>
                    <PermissionDeniedApp errorMessage={permissionDeniedMessage} />
                </React.Suspense>
            ) : (
                <Routes location={displayLocation} />
            )}
        </PrefetchContext.Provider>
    );
}

export { PrefetchContext };
