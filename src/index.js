import React from 'react';
import PropTypes from 'prop-types';
import { createRoot } from 'react-dom/client';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { ThemeProvider } from 'src/context/ThemeContext';
import 'src/css/index.css';

// Keeps boilerplate code in one place for maintainability
export const PageWrapper = ({ children }) => {
    return (
        <ThemeProvider>
            { children }
            <Toast />
            <ErrorModal />
        </ThemeProvider>
    );
};

PageWrapper.propTypes = {
    children: PropTypes.node,
};

// Used by each index.js in subdirs of src/pages/
/* istanbul ignore next */
const RenderApp = ({ App }) => {
    const container = document.getElementById('root');
    const root = createRoot(container);
    root.render(
        <PageWrapper>
            <App />
        </PageWrapper>
    );
};

export default RenderApp;
