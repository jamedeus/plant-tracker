import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import { useLocation } from 'react-router-dom';
import { PrefetchContext } from './TransitionRouter';

// Generic wrapper that renders a component with prefetched data.
// - If `component` is provided, it will be rendered with `{ initialState: data }` by default
// - If `render` is provided, it will be called as `render(data, { version })`
// - Forces a remount when `version` changes to allow Apps to reinitialize from new initialState
export default function Prefetched({ render }) {
    const { getPrefetched, version } = useContext(PrefetchContext);
    const location = useLocation();
    const prefetched = getPrefetched(location.pathname);
    const data = prefetched?.data;
    if (!data) return null;

    if (typeof render === 'function') {
        return (
            <React.Fragment key={`${location.pathname}-${version}`}>
                {render(data, { version })}
            </React.Fragment>
        );
    }

    return null;
}

Prefetched.propTypes = {
    render: PropTypes.func,
};
