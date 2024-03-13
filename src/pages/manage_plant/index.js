import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'src/main.css';
import { ToastProvider } from 'src/context/ToastContext';
import { ThemeProvider } from 'src/context/ThemeContext';


const container = document.getElementById('root');
const root = createRoot(container);
root.render(
    <ThemeProvider>
        <ToastProvider>
            <App />
        </ToastProvider>
    </ThemeProvider>
);
