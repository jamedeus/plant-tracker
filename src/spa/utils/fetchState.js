// Reusable JSON state fetcher for SPA pages.
// Returns uniform shape in all cases to simplify consumers:
// {
//   redirected: boolean,
//   ok: boolean,
//   permissionDenied?: boolean,
//   error?: string,
//   data?: any,
//   status: number
// }

async function fetchState(url, onPermissionDenied) {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';

    // If backend issued a redirect (auth/single-user), hand off to browser
    if (response.redirected || (!contentType.includes('application/json') && response.status >= 300 && response.status < 400)) {
        window.location.href = response.url || url;
        return { redirected: true, ok: false, status: response.status };
    }

    let payload = null;
    try {
        payload = contentType.includes('application/json') ? await response.json() : null;
    } catch (_) { /* ignore non-JSON */ }

    if (response.status === 403) {
        const error = payload?.state?.error || payload?.error || 'You do not have permission to view this page';
        if (typeof onPermissionDenied === 'function') onPermissionDenied(error);
        return { ok: false, permissionDenied: true, status: response.status, error };
    }

    if (!response.ok) {
        const error = payload?.error || `Request failed (${response.status})`;
        return { ok: false, error, status: response.status };
    }

    return { ok: true, data: payload, status: response.status };
}

export { fetchState };


