import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Routes from './routes';

// Lazy imports of route-level adapters so we can pre-load them
const importOverview = () => import(/* webpackChunkName: "overview_adapter" */ './adapters/Overview');
const importArchived = () => import(/* webpackChunkName: "archived_adapter" */ './adapters/Archived');
const importManage = () => import(/* webpackChunkName: "manage_adapter" */ './adapters/Manage');
const importUserProfile = () => import(/* webpackChunkName: "user_profile_adapter" */ './adapters/UserProfile');

// Page-level apps used by manage; pre-load based on resolver response
const importManagePlantApp = () => import('src/pages/manage_plant/App');
const importManageGroupApp = () => import('src/pages/manage_group/App');
const importRegisterApp = () => import('src/pages/register/App');

const PermissionDeniedApp = React.lazy(() => import('src/pages/permission_denied/App'));

const PrefetchContext = createContext({
    getPrefetched: () => null,
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
            await importOverview();
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
            await importArchived();
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
            await importManage();
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
            if (data.page === 'manage_plant') await importManagePlantApp();
            else if (data.page === 'manage_group') await importManageGroupApp();
            else if (data.page === 'register') await importRegisterApp();
            return { data, status: response.status };
        }
        case 'user_profile': {
            await importUserProfile();
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
        prefetchedRef.current.set(pathname, { route, ...result });
        setDisplayLocation(nextLocation);
    }, []);

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

    const contextValue = useMemo(() => ({ getPrefetched }), [getPrefetched]);

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


