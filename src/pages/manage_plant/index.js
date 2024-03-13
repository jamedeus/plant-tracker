import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'src/main.css';
import { ToastProvider } from 'src/ToastContext';
import { ThemeProvider } from 'src/ThemeContext';


const container = document.getElementById('root');
const root = createRoot(container);
root.render(
    <ThemeProvider>
        <ToastProvider>
            <App />
        </ToastProvider>
    </ThemeProvider>
);
