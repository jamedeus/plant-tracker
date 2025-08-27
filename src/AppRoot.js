import React, { Suspense } from 'react';
import PropTypes from 'prop-types';
import { RouterProvider } from 'react-router-dom';
import 'src/css/index.css';

export default function AppRoot({ router }) {
    return (
        <Suspense fallback={null}>
            <RouterProvider router={router} />
        </Suspense>
    );
}

AppRoot.propTypes = {
    router: PropTypes.object.isRequired
};
