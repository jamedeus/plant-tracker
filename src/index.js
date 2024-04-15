import React from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from 'src/context/ToastContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import 'src/main.css';

// Used by each index.js in subdirs of src/pages/
// Keeps all boilerplate code in one place for maintainability
const PageWrapper = ({ App }) => {
    const container = document.getElementById('root');
    const root = createRoot(container);
    root.render(
        <ThemeProvider>
            <ToastProvider>
                <ErrorModalProvider>
                    <App />
                </ErrorModalProvider>
            </ToastProvider>
        </ThemeProvider>
    );
};

export default PageWrapper;
