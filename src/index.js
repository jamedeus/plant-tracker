import React from 'react';
import PropTypes from 'prop-types';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import 'src/main.css';

// Keeps boilerplate code in one place for maintainability
export const PageWrapper = ({ children }) => {
    return (
        <ThemeProvider>
            <ErrorModalProvider>
                { children }
            </ErrorModalProvider>
        </ThemeProvider>
    );
};

PageWrapper.propTypes = {
    children: PropTypes.node,
};

// Used by each index.js in subdirs of src/pages/
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
