import Cookies from 'js-cookie';
import { navigate } from 'src/navigate';
import { openErrorModal } from 'src/components/ErrorModal';

// Takes endpoint and POST body, makes backend request with csrftoken.
// Handles 401 response automatically by redirecting to login page.
//
// Processes response if either optional callback (onSuccess or onError) given.
// Decodes response and passes to onSuccess if successful, onError if failed.
// If onError not given decodes response and shows error in ErrorModal.
// Returns true if successful, false if failed.
//
// Returns response unprocessed if neither callback given.
export default async function sendPostRequest(url, body, onSuccess, onError) {
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            "X-CSRFToken": Cookies.get('csrftoken'),
            "User-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone
        }
    });

    // Redirect to login page if user not signed in/session expired
    if (response.status === 401) {
        navigate('/accounts/login/');
        return;
    }

    // Return response unprocessed if neither callback given
    if (!onSuccess && !onError) {
        return response;
    }

    const data = await response.json();
    if (response.ok) {
        // Pass response data to onSuccess callback if request succeeded
        if (onSuccess) {
            onSuccess(data);
        }
        return true;
    } else {
        if (onError) {
            // Pass error data to onError callback if request failed
            onError(data, response.status);
        } else {
            // Show error in ErrorModal if failed and no onError callback
            openErrorModal(JSON.stringify(data));
        }
        return false;
    }
}
