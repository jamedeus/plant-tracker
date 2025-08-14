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
                const [state, config] = await Promise.all([
                    fetchState('/get_archived_overview_state', (msg) => setDeniedMessage(msg)),
                    fetchState('/get_app_config')
                ]);
                if (!isMounted) return;
                if (state.data && state.data.redirect) {
                    navigate(state.data.redirect, { replace: true });
                    return;
                }
                if (!state.ok) {
                    setDeniedMessage(state.error || 'Unable to load page');
                    return;
                }
                if (!config.ok) {
                    setDeniedMessage(config.error || 'Unable to load page');
                    return;
                }
                setReady({
                    plants: state.data.plants,
                    groups: state.data.groups,
                    show_archive: state.data.show_archive,
                    user_accounts_enabled: config.data.user_accounts_enabled
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
            initialUserAccountsEnabled={ready.user_accounts_enabled}
        />
    );
}


