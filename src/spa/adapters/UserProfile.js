import React from 'react';
import App from 'src/pages/user_profile/App';
import { usePrefetchedState } from '../TransitionRouter';

export default function UserProfileAdapter() {
    const prefetched = usePrefetchedState();
    if (!prefetched || !prefetched.data) return null;
    const { user_details } = prefetched.data;
    return <App initialUserDetails={user_details} />;
}
