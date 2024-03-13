import React from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from 'src/context/ToastContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import 'src/main.css';

// Used by each index.js in subdirs of src/pages/
// Keeps all boilerplate code in one place for maintainability
const PageWrapper = ({ App }) => {
    const container = document.getElementById('root');
    const root = createRoot(container);
    root.render(
        <ThemeProvider>
            <ToastProvider>
                <App />
            </ToastProvider>
        </ThemeProvider>
    );
};

export default PageWrapper;
