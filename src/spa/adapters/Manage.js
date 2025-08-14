import React, { lazy, useMemo } from 'react';
import { usePrefetchedState } from '../TransitionRouter';

const ManagePlantApp = lazy(() => import('src/pages/manage_plant/App'));
const ManageGroupApp = lazy(() => import('src/pages/manage_group/App'));
const RegisterApp = lazy(() => import('src/pages/register/App'));

export default function ManageAdapter() {
    const prefetched = usePrefetchedState();
    if (!prefetched || !prefetched.data) return null;
    const data = prefetched.data;

    const AppComponent = useMemo(() => {
        switch (data.page) {
            case 'manage_plant':
                return ManagePlantApp;
            case 'manage_group':
                return ManageGroupApp;
            case 'register':
                return RegisterApp;
            default:
                return null;
        }
    }, [data.page]);

    if (!AppComponent) return null;
    if (data.title) {
        document.title = data.title;
    }
    return <AppComponent initialState={data.state || {}} />;
}


