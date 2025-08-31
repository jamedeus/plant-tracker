import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { groupSlice } from './groupSlice';
import plantDetailsProptypes from 'src/types/plantDetailsPropTypes';
import groupDetailsProptypes from 'src/types/groupDetailsPropTypes';

// Takes initial groupSlice state, returns redux store
function createReduxStore(preloadedState) {
    return configureStore({
        reducer: {
            group: groupSlice.reducer
        },
        preloadedState
    });
}

export function ReduxProvider({ children, initialState }) {
    const init = () => {
        // Return object with keys expected by groupSlice
        return {
            group: {
                groupDetails: initialState.group_details,
                plantDetails: initialState.plants
            },
        };
    };

    // Create redux store
    const store = useMemo(() => createReduxStore(
        init()
    ), [initialState]);

    return (
        <Provider store={store}>
            {children}
        </Provider>
    );
}

ReduxProvider.propTypes = {
    children: PropTypes.node,
    initialState: PropTypes.shape({
        group_details: groupDetailsProptypes.isRequired,
        plants: PropTypes.objectOf(plantDetailsProptypes).isRequired,
    }).isRequired
};
