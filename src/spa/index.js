import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import TransitionRouter from './TransitionRouter';
import { PageWrapper } from 'src/index';
import { parseDomContext } from 'src/util';

const PermissionDeniedApp = React.lazy(() => import('src/pages/permission_denied/App'));
import 'src/css/index.css';

/* istanbul ignore next */
function bootstrapSpa() {
    const container = document.getElementById('root');
    const root = createRoot(container);
    const initialError = parseDomContext('error');
    root.render(
        <PageWrapper>
            <BrowserRouter>
                <Suspense fallback={null}>
                    {initialError ? (
                        <PermissionDeniedApp errorMessage={initialError} />
                    ) : (
                        <TransitionRouter />
                    )}
                </Suspense>
            </BrowserRouter>
        </PageWrapper>
    );
}

bootstrapSpa();


