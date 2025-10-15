import Cookies from 'js-cookie';
import { navigate } from 'src/navigate';
import { openErrorModal } from 'src/components/ErrorModal';

// Takes endpoint and POST body, makes backend request with csrftoken.
// Handles 401 response automatically by redirecting to login page.
//
// If optional onSuccess callback is given processes response by passing decoded
// data to onSuccess if successful, or passing decoded error to openErrorModal
// if failed. Returns true if successful, false if failed.
//
// If onSuccess callback is not given returns response unprocessed.
export default async function sendPostRequest(url, body, onSuccess) {
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            "X-CSRFToken": Cookies.get('csrftoken')
        }
    });

    // Redirect to login page if user not signed in/session expired
    if (response.status === 401) {
        navigate('/accounts/login/');
        // Return mock error that ErrorModal won't show
        // (prevents exception when caller tries response.json())
        return new Response(JSON.stringify('spa-redirect'), {
            ok: false,
            status: 401
        });
    }

    // Process response automatically if onSuccess callback given
    if (onSuccess) {
        if (!response.ok) {
            // Show error in ErrorModal if request failed
            const error = await response.json();
            openErrorModal(JSON.stringify(error));
            return false;
        } else {
            // Pass response data to onSuccess callback if request succeeded
            const data = await response.json();
            onSuccess(data);
            return true;
        }
    }

    // Return response unprocessed if no onSuccess callback given
    return response;
}
