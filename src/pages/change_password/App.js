import React, { useState, useMemo, useRef } from 'react';
import { useTheme } from 'src/context/ThemeContext';
import Navbar from 'src/components/Navbar';
import Cookies from 'js-cookie';
import clsx from 'clsx';

function App() {
    const { ToggleThemeOption } = useTheme();

    const formRef = useRef(null);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword1, setNewPassword1] = useState('');
    const [newPassword2, setNewPassword2] = useState('');
    const [oldPasswordIncorrect, setOldPasswordIncorrect] = useState(false);
    const [newPasswordError, setNewPasswordError] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        // Post old and new password to backend
        const response = await fetch("/accounts/change_password/submit/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRFToken": Cookies.get('csrftoken')
            },
            credentials: "include",
            body: new URLSearchParams({
                old_password: oldPassword,
                new_password1: newPassword1,
                new_password2: newPassword2,
            }),
        });
        // Redirect to overview if logged in successfully
        if (response.ok) {
            window.location.href = '/';
        // Show correct error message if login failed
        } else {
            const errors = await response.json();
            if (errors.errors.old_password) {
                setOldPasswordIncorrect(true);
            }
            if (errors.errors.new_password2) {
                setNewPasswordError(errors.errors.new_password2[0]);
            }
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
                title="Change Password"
            />

            <form ref={formRef} className="flex flex-col gap-4 mt-[15vh]">
                <label className="form-control w-full">
                    <div className="label">
                        <span className="label-text">Old password</span>
                    </div>
                    <input
                        name="old_password"
                        type="password"
                        className={clsx(
                            "input w-full input-bordered",
                            oldPasswordIncorrect && "input-error"
                        )}
                        value={oldPassword}
                        onInput={() => setOldPasswordIncorrect(false)}
                        onChange={(e) => setOldPassword(e.target.value)}
                    />
                </label>
                {oldPasswordIncorrect && (
                    <span className="text-error">
                        Old password incorrect
                    </span>
                )}
                <label className="form-control w-full relative">
                    <div className="label">
                        <span className="label-text">New password</span>
                    </div>
                    <input
                        name="new_password1"
                        type="password"
                        className={clsx(
                            "input w-full input-bordered",
                            newPasswordError && "input-error"
                        )}
                        value={newPassword1}
                        onChange={(e) => setNewPassword1(e.target.value)}
                    />
                </label>
                <label className="form-control w-full">
                    <div className="label">
                        <span className="label-text">Confirm new password</span>
                    </div>
                    <input
                        name="new_password2"
                        type="password"
                        className={clsx(
                            "input w-full input-bordered",
                            newPasswordError && "input-error"
                        )}
                        value={newPassword2}
                        onInput={() => setNewPasswordError(false)}
                        onChange={(e) => setNewPassword2(e.target.value)}
                    />
                </label>
                {newPasswordError && (
                    <span className="text-error">
                        {newPasswordError}
                    </span>
                )}

                <button
                    className="btn btn-success mt-6"
                    onClick={(e) => submit(e)}
                >
                    Change password
                </button>
            </form>
        </div>
    );
}

export default App;
