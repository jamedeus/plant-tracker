import React, { useState, useRef } from 'react';
import { useTheme } from 'src/context/ThemeContext';
import Navbar from 'src/components/Navbar';
import { sendPostRequest } from 'src/util';
import { EMAIL_REGEX } from 'src/regex';
import Cookies from 'js-cookie';
import clsx from 'clsx';

const LoginForm = () => {
    const formRef = useRef(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showError, setShowError] = useState(false);

    // Disable login button until fields reach minimum length
    const formValid = username.length >= 3 && password.length >= 8;

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

    return (
        <form ref={formRef} className="flex flex-col gap-4 mt-8">
            <label
                className="form-control w-full"
                title="Username or email address"
            >
                <div className="label">
                    <span className="label-text">Username</span>
                </div>
                <input
                    name="username"
                    type="text"
                    autoFocus
                    autoCapitalize="off"
                    tabIndex={1}
                    className={clsx(
                        "input w-full input-bordered",
                        showError && "input-error"
                    )}
                    value={username}
                    onInput={() => setShowError(false)}
                    onChange={e => setUsername(e.target.value)}
                />
            </label>
            <label
                className="form-control w-full relative"
                title="Must be at least 8 characters, can't be all numbers"
            >
                <div className="label">
                    <span className="label-text">Password</span>
                </div>
                <input
                    name="password"
                    type="password"
                    tabIndex={1}
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
                disabled={!formValid}
                tabIndex={1}
            >
                Login
            </button>

            {showError && (
                <span className="text-error text-center">
                    Invalid username or password
                </span>
            )}
        </form>
    );
};

const RegisterForm = () => {
    const formRef = useRef(null);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showError, setShowError] = useState(false);
    const [showEmailError, setShowEmailError] = useState(false);
    const [showUsernameError, setShowUsernameError] = useState(false);
    const [showPasswordError, setShowPasswordError] = useState(false);

    // Disable submit button until fields reach minimum length and email valid
    const formValid = username.length >= 3 &&
                      password.length >= 8 &&
                      EMAIL_REGEX.test(email);

    const clearErrors = () => {
        setShowError(false);
        setShowUsernameError(false);
        setShowPasswordError(false);
    };

    const submit = async (e) => {
        e.preventDefault();
        // Post FormData to backend
        const formData = new FormData(formRef.current);
        const response = await sendPostRequest(
            '/accounts/create_user/',
            Object.fromEntries(formData)
        );
        // Redirect to overview if logged in successfully
        if (response.ok) {
            window.location.href = '/';
        // Show correct error if account creation failed
        } else {
            const data = await response.json();
            const error = data.error[0];
            if (error === 'username already exists') {
                setShowUsernameError(error);
            } else if (error.includes('email')) {
                setShowEmailError(error);
            } else if (error.startsWith('This password')) {
                setShowPasswordError(error);
            } else {
                setShowError(error);
            }
        }
    };

    return (
        <form ref={formRef} className="flex flex-col gap-4">
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text">Email *</span>
                </div>
                <input
                    name="email"
                    type="email"
                    autoFocus
                    autoCapitalize="off"
                    tabIndex={1}
                    className={clsx(
                        "input w-full input-bordered",
                        (showError || showEmailError) && "input-error"
                    )}
                    value={email}
                    onInput={() => setShowError(false)}
                    onChange={e => setEmail(e.target.value)}
                />
            </label>
            {showEmailError && (
                <span className="text-error text-center">
                    {showEmailError}
                </span>
            )}
            <label
                className="form-control w-full"
                title="Must be at least 3 characters"
            >
                <div className="label">
                    <span className="label-text">Username *</span>
                </div>
                <input
                    name="username"
                    type="text"
                    autoCapitalize="off"
                    tabIndex={1}
                    className={clsx(
                        "input w-full input-bordered",
                        (showError || showUsernameError) && "input-error"
                    )}
                    value={username}
                    onInput={clearErrors}
                    onChange={e => setUsername(e.target.value)}
                />
            </label>
            {showUsernameError && (
                <span className="text-error text-center">
                    {showUsernameError}
                </span>
            )}
            <label
                className="form-control w-full relative"
                title="Must be at least 8 characters, can't be all numbers"
            >
                <div className="label">
                    <span className="label-text">Password *</span>
                </div>
                <input
                    name="password"
                    type="password"
                    tabIndex={1}
                    className={clsx(
                        "input w-full input-bordered",
                        (showError || showPasswordError) && "input-error"
                    )}
                    value={password}
                    onInput={clearErrors}
                    onChange={e => setPassword(e.target.value)}
                />
            </label>
            {showPasswordError && (
                <span className="text-error text-center">
                    {showPasswordError}
                </span>
            )}
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text">First name</span>
                </div>
                <input
                    name="first_name"
                    type="text"
                    tabIndex={1}
                    className="input w-full input-bordered"
                />
            </label>
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text">Last name</span>
                </div>
                <input
                    name="last_name"
                    type="text"
                    tabIndex={1}
                    className="input w-full input-bordered"
                />
            </label>

            <span className="text-center text-sm">
                * required fields
            </span>

            <button
                className="btn btn-success mt-6"
                onClick={(e) => submit(e)}
                disabled={!formValid}
                tabIndex={1}
            >
                Create account
            </button>

            {showError && (
                <span className="text-error text-center">
                    {showError}
                </span>
            )}
        </form>
    );
};

function App() {
    const { ToggleThemeOption } = useTheme();

    const [showLoginForm, setShowLoginForm] = useState(true);

    const toggleForm = () => setShowLoginForm(!showLoginForm);

    return (
        <div className="container flex flex-col h-screen mx-auto items-center">
            <Navbar
                menuOptions={<ToggleThemeOption />}
                title={showLoginForm ? "Login" : "Create Account"}
            />

            <div className="flex flex-col w-96 max-w-[100vw] gap-4 px-4 md:mt-16">
                {showLoginForm ? <LoginForm /> : <RegisterForm />}
            </div>

            <div className="pb-8">
                <button
                    className={clsx(
                        "text-center text-base-content mt-8",
                        "transition-all hover:text-white"
                    )}
                    onClick={toggleForm}
                    tabIndex={1}
                >
                    {showLoginForm ? "Create account" : "Already have an account?"}
                </button>
            </div>
        </div>
    );
}

export default App;
