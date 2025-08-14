import React from 'react';
import PropTypes from 'prop-types';
import App from 'src/pages/permission_denied/App';

export default function PermissionDeniedAdapter({ error }) {
    return <App errorMessage={error || 'You do not have permission to view this page'} />;
}

PermissionDeniedAdapter.propTypes = {
    error: PropTypes.string
};
