import React, { useEffect, useState, Suspense, lazy } from 'react';
import App from 'src/pages/user_profile/App';
import { fetchState } from '../utils/fetchState';

export default function UserProfileAdapter() {
    const [state, setState] = useState(null);
    const [deniedMessage, setDeniedMessage] = useState(null);
    const PermissionDeniedApp = lazy(() => import('src/pages/permission_denied/App'));

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { ok, error, redirected } = await fetchState('/accounts/profile/', (msg) => setDeniedMessage(msg));
                if (redirected) return;
                if (!ok) {
                    setDeniedMessage(error || 'Unable to load page');
                    return;
                }
                // state is embedded in DOM by backend render_react_app for this page
                const payload = window.document.getElementById('user_details');
                if (!payload) throw new Error('Missing user details');
                const userDetails = JSON.parse(payload.textContent);
                if (!mounted) return;
                setState(userDetails);
            } catch (e) {
                if (!mounted) return;
                setDeniedMessage(String(e));
            }
        })();
        return () => { mounted = false; };
    }, []);

    if (deniedMessage) {
        return (
            <Suspense fallback={null}>
                <PermissionDeniedApp errorMessage={deniedMessage} />
            </Suspense>
        );
    }
    if (!state) {
        return (
            <div className="container flex flex-col items-center mx-auto p-4">
                <span>Loading…</span>
            </div>
        );
    }
    return <App initialUserDetails={state} />;
}
