import React, { useEffect, useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import App from 'src/pages/overview/App';
import { fetchState } from '../utils/fetchState';

export default function ArchivedAdapter() {
    const [ready, setReady] = useState(false);
    const [deniedMessage, setDeniedMessage] = useState(null);
    const navigate = useNavigate();
    const PermissionDeniedApp = lazy(() => import('src/pages/permission_denied/App'));

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const { redirected, ok, data, error } = await fetchState('/get_archived_overview_state', (msg) => setDeniedMessage(msg));
                if (!isMounted) return;
                if (redirected) {
                    navigate(redirected, { replace: true });
                    return;
                }
                if (!ok) {
                    setDeniedMessage(error || 'Unable to load page');
                    return;
                }
                setReady({
                    plants: data.plants,
                    groups: data.groups,
                    show_archive: data.show_archive,
                });
            } catch (e) {
                if (!isMounted) return;
                setDeniedMessage(String(e));
            }
        })();
        return () => { isMounted = false; };
    }, [navigate]);

    if (deniedMessage) {
        return (
            <Suspense fallback={null}>
                <PermissionDeniedApp errorMessage={deniedMessage} />
            </Suspense>
        );
    }
    if (!ready) {
        return (
            <div className="container flex flex-col items-center mx-auto p-4">
                <span>Loading archived overview…</span>
            </div>
        );
    }
    return (
        <App
            initialPlants={ready.plants}
            initialGroups={ready.groups}
            initialShowArchive={ready.show_archive}
        />
    );
}


