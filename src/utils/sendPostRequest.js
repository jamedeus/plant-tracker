import Cookies from 'js-cookie';
import router from 'src/routes';

// Takes endpoint and POST body, makes backend request, returns response
export default async function sendPostRequest(url, body) {
    const csrftoken = Cookies.get('csrftoken');

    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            "X-CSRFToken": csrftoken
        }
    });

    // Redirect to login page if user not signed in/session expired
    if (response.status === 401) {
        router.navigate('/accounts/login/');
        // Return mock error that ErrorModal won't show
        // (prevents exception when caller tries response.json())
        return new Response(JSON.stringify('spa-redirect'), {
            ok: false,
            status: 401
        });
    }

    return response;
}
