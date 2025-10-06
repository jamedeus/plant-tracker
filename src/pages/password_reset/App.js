import React, { useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ToggleThemeOption from 'src/components/ToggleThemeOption';
import Checkmark from 'src/components/Checkmark';
import Navbar from 'src/components/Navbar';
import clsx from 'clsx';
import Cookies from 'js-cookie';
import 'src/css/index.css';

function App() {
    const navigate = useNavigate();
    const formRef = useRef(null);
    const [newPassword1, setNewPassword1] = useState('');
    const [newPassword2, setNewPassword2] = useState('');
    const [newPasswordError, setNewPasswordError] = useState('');
    // Either 'idle', 'loading', or 'success'
    const [submitStatus, setSubmitStatus] = useState('idle');

    // Enable submit button when all fields reach minimum password length and
    // both new password fields match
    const submitButtonDisabled = newPassword1.length < 8 ||
                                 newPassword2.length < 8 ||
                                 newPassword1 != newPassword2;

    const submit = async (e) => {
        e.preventDefault();
        if (submitStatus !== 'idle') {
            return;
        }
        setSubmitStatus('loading');
        // Post new password to backend
        const formData = new FormData(formRef.current);
        const response = await fetch(window.location.pathname, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'X-CSRFToken': Cookies.get('csrftoken')
            }
        });
        // Show checkmark and redirect to profile page if successful
        if (response.ok) {
            setSubmitStatus('success');
            setTimeout(() => { navigate('/accounts/profile/'); }, 1500);
        // Show error and highlight fields red if unsuccessful
        } else {
            const errors = await response.json();
            if (errors.errors.new_password2) {
                setNewPasswordError(errors.errors.new_password2[0]);
                return;
            }
            setNewPasswordError('Failed to change password.');
            setSubmitStatus('idle');
        }
    };

    const submitOnEnterKey = async (event) => {
        if (event.key === 'Enter' && !submitButtonDisabled) {
            await submit(event);
        }
    };

    const DropdownMenuOptions = useMemo(() => (
        <>
            <li><Link to='/' discover="none">
                Overview
            </Link></li>
            <ToggleThemeOption />
        </>
    ), [ToggleThemeOption]);

    return (
        <div
            className="container flex flex-col full-screen mx-auto items-center"
            data-testid="password-reset-page"
        >
            <Navbar
                menuOptions={DropdownMenuOptions}
                title="Reset Password"
            />
            <div className="flex flex-col w-96 max-w-[100vw] gap-4 md:gap-6 px-4 md:mt-16">
                <form ref={formRef} className="flex flex-col gap-2">
                    <label title="Must be at least 8 characters, can't be all numbers">
                        <span>New password</span>
                        <input
                            name="new_password1"
                            type="password"
                            className={clsx(
                                "input w-full",
                                newPasswordError && "border-error"
                            )}
                            value={newPassword1}
                            onKeyDown={(e) => submitOnEnterKey(e)}
                            onChange={(e) => setNewPassword1(e.target.value)}
                        />
                    </label>
                    <label title="Must be at least 8 characters, can't be all numbers">
                        <span>Confirm new password</span>
                        <input
                            name="new_password2"
                            type="password"
                            className={clsx(
                                "input w-full",
                                newPasswordError && "border-error"
                            )}
                            value={newPassword2}
                            onKeyDown={(e) => submitOnEnterKey(e)}
                            onChange={(e) => setNewPassword2(e.target.value)}
                        />
                    </label>
                    {newPasswordError && (
                        <span className="text-error text-center">
                            {newPasswordError}
                        </span>
                    )}

                    <button
                        className="btn btn-accent mt-6"
                        disabled={submitButtonDisabled}
                        onClick={(e) => submit(e)}
                        data-testid="submit-button"
                    >
                        {submitStatus === 'idle' && (
                            <span>Change Password</span>
                        )}
                        {submitStatus === 'loading' && (
                            <span className="loading loading-spinner loading-xl"></span>
                        )}
                        {submitStatus === 'success' && (
                            <Checkmark className="w-8" />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default App;
