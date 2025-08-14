import React from 'react';
import App from 'src/pages/overview/App';
import { usePrefetchedState } from '../TransitionRouter';

export default function OverviewAdapter() {
    const prefetched = usePrefetchedState();
    if (!prefetched || !prefetched.data) return null;
    const data = prefetched.data;
    return (
        <App
            initialPlants={data.plants}
            initialGroups={data.groups}
            initialShowArchive={data.show_archive}
        />
    );
}


