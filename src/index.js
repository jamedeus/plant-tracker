import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import router from 'src/routes';
import { useBackButton } from 'src/hooks/useBackButton';
import 'src/css/index.css';

function AppRoot() {
    // Get new state for current page when user navigates from external site
    // back to SPA using browser back/forward buttons
    useBackButton(() => router.revalidate());

    return (
        <Suspense fallback={null}>
            <RouterProvider router={router} />
        </Suspense>
    );
}

/* istanbul ignore next */
function bootstrapSpa() {
    const container = document.getElementById('root');
    const root = createRoot(container);
    root.render(<AppRoot />);
}

bootstrapSpa();
