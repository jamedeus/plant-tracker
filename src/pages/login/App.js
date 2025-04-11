import React, { useState, useMemo, useRef } from 'react';
import { useTheme } from 'src/context/ThemeContext';
import Navbar from 'src/components/Navbar';
import Cookies from 'js-cookie';
import clsx from 'clsx';

function App() {
    const { ToggleThemeOption } = useTheme();

    const formRef = useRef(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showError, setShowError] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        // Post FormData to backend
        const formData = new FormData(formRef.current);
        const response = await fetch('/accounts/login/', {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                "X-CSRFToken": Cookies.get('csrftoken')
            }
        });
        // Redirect if logged in successfully
        if (response.ok) {
            // Redirect to url in querystring if present
            const params = new URL(window.location.href).searchParams;
            if (params.get('next')) {
                window.location.href = params.get('next');
            // Redirect to overview if no querystring
            } else {
                window.location.href = '/';
            }
        // Show error text if login failed
        } else {
            setShowError(true);
        }
    };

    const DropdownMenuOptions = useMemo(() => (
        <>
            <li><a onClick={() => window.location.href = "/"}>
                Overview
            </a></li>
            <ToggleThemeOption />
        </>
    ), [ToggleThemeOption]);

    return (
        <div className="container flex flex-col h-screen mx-auto items-center">
            <Navbar
                menuOptions={DropdownMenuOptions}
                title="Login"
            />

            <form ref={formRef} className="flex flex-col gap-4 mt-[15vh]">
                <label className="form-control w-full">
                    <div className="label">
                        <span className="label-text">Username</span>
                    </div>
                    <input
                        name="username"
                        type="text"
                        autoCapitalize="off"
                        className={clsx(
                            "input w-full input-bordered",
                            showError && "input-error"
                        )}
                        value={username}
                        onInput={() => setShowError(false)}
                        onChange={e => setUsername(e.target.value)}
                    />
                </label>
                <label className="form-control w-full relative">
                    <div className="label">
                        <span className="label-text">Password</span>
                    </div>
                    <input
                        name="password"
                        type="password"
                        className={clsx(
                            "input w-full input-bordered",
                            showError && "input-error"
                        )}
                        value={password}
                        onInput={() => setShowError(false)}
                        onChange={e => setPassword(e.target.value)}
                    />
                </label>

                <button
                    className="btn btn-success mt-6"
                    onClick={(e) => submit(e)}
                    disabled={username.length < 1 || password.length < 1}
                >
                    Login
                </button>

                {showError && (
                    <span className="text-error text-center">
                        Invalid username or password
                    </span>
                )}
            </form>
        </div>
    );
}

export default App;
