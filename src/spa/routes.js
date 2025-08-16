import React from 'react';
import {
    createBrowserRouter,
    Navigate,
    useLoaderData,
    useRouteError,
    isRouteErrorResponse,
} from 'react-router-dom';
import {
    OverviewApp,
    ManagePlantApp,
    ManageGroupApp,
    RegisterApp,
    LoginApp,
    UserProfileApp,
    PasswordResetApp,
    PermissionDeniedApp,
} from './bundles';

// Helper to fetch JSON with redirect/CT handling (mirrors previous behavior)
async function fetchJSON(url) {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        if (response.redirected) {
            window.location.href = response.url || url;
            return { response, body: null, redirected: true };
        }
    }
    const body = contentType.includes('application/json') ? await response.json() : null;
    return { response, body, redirected: false };
}

// Generic adapter: renders App with loader data as `initialState`
function makePageRoute(App) {
    return function PageRoute() {
        const payload = useLoaderData();
        return <App initialState={payload} />;
    };
}

const OverviewRoute = makePageRoute(OverviewApp);
const ArchivedRoute = makePageRoute(OverviewApp);
const UserProfileRoute = makePageRoute(UserProfileApp);

// Maps /manage/<uuid> initial state page key to correct component
const ManageComponentMap = {
    manage_plant: ManagePlantApp,
    manage_group: ManageGroupApp,
    register: RegisterApp,
};

// Custom route for /manage/<uuid> (load correct component for initial state)
function ManageRoute() {
    const payload = useLoaderData();
    if (!payload || !payload.page) return null;
    const Component = ManageComponentMap[payload.page];
    return <Component initialState={payload.state || {}} />;
}

// Renders PermissionDeniedApp with error message from response
function ErrorBoundaryRoute() {
    const error = useRouteError();

    if (isRouteErrorResponse(error)) {
        if (error.status === 403) {
            const message = error.statusText || 'You do not have permission to view this page';
            document.title = 'Permission Denied';
            return <PermissionDeniedApp errorMessage={message} />;
        }
        const message = error.statusText || `Request failed (${error.status})`;
        return <PermissionDeniedApp errorMessage={message} />;
    }

    // Non-Response thrown (e.g., unexpected)
    return <PermissionDeniedApp errorMessage="An unexpected error occurred" />;
}

const router = createBrowserRouter([
    {
        path: '/',
        Component: OverviewRoute,
        errorElement: <ErrorBoundaryRoute />,
        loader: async () => {
            await OverviewApp.preload();
            const { response, body, redirected } = await fetchJSON('/get_overview_state');
            if (redirected) return null;
            if (!response.ok) {
                throw new Response('', {
                    status: response.status,
                    statusText: body?.error || `Request failed (${response.status})`,
                });
            }
            return body;
        },
    },
    {
        path: '/archived',
        Component: ArchivedRoute,
        errorElement: <ErrorBoundaryRoute />,
        loader: async () => {
            await OverviewApp.preload();
            const { response, body, redirected } = await fetchJSON('/get_archived_overview_state');
            if (redirected) return null;
            if (!response.ok) {
                throw new Response('', {
                    status: response.status,
                    statusText: body?.error || `Request failed (${response.status})`,
                });
            }
            return body;
        },
    },
    {
        path: '/manage/:uuid',
        Component: ManageRoute,
        errorElement: <ErrorBoundaryRoute />,
        loader: async ({ params }) => {
            const { response, body, redirected } = await fetchJSON(`/resolve_manage/${params.uuid}`);
            if (redirected) return null;

            if (response.status === 403) {
                throw new Response('', {
                    status: 403,
                    statusText: body?.state?.error || body?.error || 'You do not have permission to view this page',
                });
            }
            if (!response.ok) {
                throw new Response('', {
                    status: response.status,
                    statusText: body?.error || `Request failed (${response.status})`,
                });
            }

            if (body?.title) {
                document.title = body.title;
            }
            if (body?.page === 'manage_plant') await ManagePlantApp.preload();
            else if (body?.page === 'manage_group') await ManageGroupApp.preload();
            else if (body?.page === 'register') await RegisterApp.preload();

            return body;
        },
    },
    {
        path: '/accounts/login/',
        Component: LoginApp,
        errorElement: <ErrorBoundaryRoute />,
    },
    {
        path: '/accounts/profile/',
        Component: UserProfileRoute,
        errorElement: <ErrorBoundaryRoute />,
        loader: async () => {
            await UserProfileApp.preload();
            const { response, body, redirected } = await fetchJSON('/accounts/get_user_details/');
            if (redirected) return null;

            if (response.status === 403) {
                throw new Response('', {
                    status: 403,
                    statusText: body?.error || 'You do not have permission to view this page',
                });
            }
            if (!response.ok) {
                throw new Response('', {
                    status: response.status,
                    statusText: body?.error || `Request failed (${response.status})`,
                });
            }
            return body;
        },
    },
    {
        path: '/accounts/password_reset/',
        Component: PasswordResetApp,
        errorElement: <ErrorBoundaryRoute />,
    },
    {
        path: '/accounts/reset/:uidb64/:token/',
        Component: PasswordResetApp,
        errorElement: <ErrorBoundaryRoute />,
    },
    {
        path: '*',
        Component: () => <Navigate to="/" replace />,
    },
]);

export default router;
