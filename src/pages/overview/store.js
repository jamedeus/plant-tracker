import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { overviewSlice } from './overviewSlice';
import { useIsBreakpointActive } from 'src/hooks/useBreakpoint';

// Takes initial plantSlice and timelineSlice states, returns redux store
function createReduxStore(preloadedState) {
    return configureStore({
        reducer: {
            overview: overviewSlice.reducer
        },
        preloadedState
    });
}

export function ReduxProvider({ children, initialState }) {
    // Get layout string used to look up default settings for current breakpoint
    const layout = useIsBreakpointActive("md") ? 'desktop' : 'mobile';

    // Parses SPA-provided context elements containing plants and groups
    const init = () => {
        // Check URL to determine if viewing main overview or archive overview
        const archivedOverview = window.location.pathname === '/archived';

        // Return object with keys expected by overviewSlice
        return {
            overview: {
                plants: initialState.plants,
                groups: initialState.groups,
                archivedOverview: archivedOverview,
                showArchive: initialState.show_archive,
                title: initialState.title
            },
        };
    };

    // Create redux store
    const store = useMemo(() => createReduxStore(
        init()
    ), [initialState, layout]);

    return (
        <Provider store={store}>
            {children}
        </Provider>
    );
}

ReduxProvider.propTypes = {
    children: PropTypes.node,
    initialState: PropTypes.shape({
        plants: PropTypes.object.isRequired,
        groups: PropTypes.object.isRequired,
        show_archive: PropTypes.bool.isRequired,
        title: PropTypes.string.isRequired
    }).isRequired
};
