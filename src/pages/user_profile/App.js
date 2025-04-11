import React, { useState, useMemo, useEffect, useRef, memo } from 'react';
import { useTheme } from 'src/context/ThemeContext';
import { parseDomContext, sendPostRequest } from 'src/util';
import { timestampToRelative, timestampToReadable } from 'src/timestampUtils';
import Navbar from 'src/components/Navbar';
import { showToast } from 'src/components/Toast';
import Cookies from 'js-cookie';
import clsx from 'clsx';

const UserDetails = memo(function UserDetails() {
    // Get initial details for form from django context
    const [userDetails, setUserDetails] = useState(() => (
        parseDomContext('user_details')
    ));

    const [firstName, setFirstName] = useState(userDetails.first_name);
    const [lastName, setLastName] = useState(userDetails.last_name);
    const [email, setEmail] = useState(userDetails.email);
    const [submitButtonDisabled, setSubmitButtonDisabled] = useState(true);

    // Enable submit button when 1 or more field has changed
    useEffect(() => {
        setSubmitButtonDisabled(
            firstName === userDetails.first_name &&
            lastName === userDetails.last_name &&
            email === userDetails.email
        );
    }, [userDetails, firstName, lastName, email]);

    const submit = async () => {
        const payload = {
            first_name: firstName,
            last_name: lastName,
            email: email
        };
        const response = await sendPostRequest(
            '/accounts/edit_user_details/',
            payload
        );
        if (response.ok) {
            setUserDetails({ ...userDetails, ...payload });
            showToast('Details updated!', 'green', 2000);
        } else {
            showToast('Unable to update details', 'red', 2000);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[min-content_1fr] gap-4">
                <div className="my-auto text-nowrap">
                    First Name:
                </div>
                <input
                    name="first_name"
                    type="text"
                    className="input w-full input-bordered"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                />
                <div className="my-auto text-nowrap">
                    Last Name:
                </div>
                <input
                    name="last_name"
                    type="text"
                    className="input w-full input-bordered"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                />
                <div className="my-auto text-nowrap">
                    Email:
                </div>
                <input
                    name="email"
                    type="text"
                    autoCapitalize="off"
                    className="input w-full input-bordered"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <div className="my-auto text-nowrap">
                    Joined:
                </div>
                <div className="text-center">
                    <span className="text-nowrap">
                        {timestampToReadable(userDetails.date_joined).split('-')[1]}
                    </span>
                    {/* Space allows line wrapping on very small screens */}
                    <span> </span>
                    <span className="text-nowrap">
                        ({timestampToRelative(userDetails.date_joined)})
                    </span>
                </div>
            </div>
            <button
                className="btn btn-info mt-4"
                disabled={submitButtonDisabled}
                onClick={submit}
            >
                Save Changes
            </button>
        </div>
    );
});

const ChangePassword = memo(function ChangePassword() {
    const formRef = useRef(null);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword1, setNewPassword1] = useState('');
    const [newPassword2, setNewPassword2] = useState('');
    const [oldPasswordIncorrect, setOldPasswordIncorrect] = useState(false);
    const [newPasswordError, setNewPasswordError] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        // Post old and new password to backend
        const response = await fetch("/accounts/change_password/", {
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

    return (
        <form ref={formRef} className="flex flex-col gap-4">
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
    );
});

const Section = ({ title, open=false, children }) => {
    return (
        <div className="collapse collapse-arrow bg-base-200">
            <input type="radio" name="my-accordion-2" defaultChecked={open} />
            <div className="collapse-title text-xl font-medium text-center">
                {title}
            </div>
            <div className="collapse-content">
                {children}
            </div>
        </div>
    );
};

function App() {
    const { ToggleThemeOption } = useTheme();

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
                title="User Profile"
            />
            <div className="flex flex-col w-96 max-w-[100vw] gap-4 px-4 md:mt-16">
                <Section title="Details" open={true}>
                    <UserDetails />
                </Section>
                <Section title="Change Password">
                    <ChangePassword />
                </Section>
                <a
                    className="btn btn-outline btn-error"
                    href="/accounts/logout/"
                >
                    Log Out
                </a>
            </div>
        </div>
    );
}

export default App;
