import React from 'react';
import PropTypes from 'prop-types';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import UnsupportedBrowserWarning from 'src/components/UnsupportedBrowserWarning';

// Keeps boilerplate code in one place for maintainability
const PageWrapper = ({ children }) => {
    return (
        <>
            { children }
            <Toast />
            <ErrorModal />
            <UnsupportedBrowserWarning />
        </>
    );
};

PageWrapper.propTypes = {
    children: PropTypes.node,
};

export default PageWrapper;
