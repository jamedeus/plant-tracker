import React, { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';
import { fetchState } from '../utils/fetchState';

const ManagePlantApp = lazy(() => import('src/pages/manage_plant/App'));
const ManageGroupApp = lazy(() => import('src/pages/manage_group/App'));
const RegisterApp = lazy(() => import('src/pages/register/App'));
const PermissionDeniedApp = lazy(() => import('src/pages/permission_denied/App'));

export default function ManageAdapter() {
    const { uuid } = useParams();
    const [deniedMessage, setDeniedMessage] = useState(null);
    const [page, setPage] = useState(null);
    const [initialState, setInitialState] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const run = async () => {
            try {
                const { redirected, ok, data, error } = await fetchState(`/resolve_manage/${uuid}`, setDeniedMessage);
                if (redirected) return;
                if (!isMounted) return;
                if (!ok) {
                    setDeniedMessage(error || 'Unable to load page');
                    return;
                }
                if (data.page === 'permission_denied') {
                    const deniedError = data?.state?.error || 'You do not have permission to view this page';
                    setDeniedMessage(deniedError);
                    return;
                }
                if (data.title) {
                    document.title = data.title;
                }
                // Save initial state to pass as props to pages
                setInitialState(data.state || {});
                setPage(data.page);
            } catch (e) {
                if (!isMounted) return;
                setDeniedMessage(String(e));
            }
        };
        run();
        return () => { isMounted = false; };
    }, [uuid]);

    const AppComponent = useMemo(() => {
        switch (page) {
            case 'manage_plant':
                return ManagePlantApp;
            case 'manage_group':
                return ManageGroupApp;
            case 'register':
                return RegisterApp;
            default:
                return null;
        }
    }, [page]);

    if (deniedMessage) {
        return (
            <Suspense fallback={
                <div className="container flex flex-col items-center mx-auto p-4">
                    <span>Loading…</span>
                </div>
            }>
                <PermissionDeniedApp errorMessage={deniedMessage} />
            </Suspense>
        );
    }
    if (!AppComponent) {
        return (
            <div className="container flex flex-col items-center mx-auto p-4">
                <span>Loading…</span>
            </div>
        );
    }
    return (
        <Suspense fallback={
            <div className="container flex flex-col items-center mx-auto p-4">
                <span>Loading…</span>
            </div>
        }>
            <AppComponent initialState={initialState} />
        </Suspense>
    );
}


