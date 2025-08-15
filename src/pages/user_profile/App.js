import React, { useState, useMemo, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import ToggleThemeOption from 'src/components/ToggleThemeOption';
import { EMAIL_REGEX } from 'src/regex';
import { sendPostRequest } from 'src/util';
import { timestampToRelative, timestampToReadable } from 'src/timestampUtils';
import Navbar from 'src/components/Navbar';
import { showToast } from 'src/components/Toast';
import QrScannerButton from 'src/components/QrScannerButton';
import Cookies from 'js-cookie';
import clsx from 'clsx';
import { FaCheck } from 'react-icons/fa6';

const UserDetails = memo(function UserDetails({ initialUserDetails }) {
    // Initialize from SPA-provided state
    const [userDetails, setUserDetails] = useState(initialUserDetails);

    const [firstName, setFirstName] = useState(userDetails.first_name);
    const [lastName, setLastName] = useState(userDetails.last_name);
    const [email, setEmail] = useState(userDetails.email);

    // Enable submit button when 1 or more field has changed
    const submitButtonDisabled = firstName === userDetails.first_name &&
                                 lastName === userDetails.last_name &&
                                 email === userDetails.email ||
                                 !EMAIL_REGEX.test(email);

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
            const data = await response.json();
            setUserDetails(data.user_details);
            showToast('Details updated!', 'green', 2000);
        } else {
            showToast('Unable to update details', 'red', 2000);
        }
    };

    const submitOnEnterKey = async (event) => {
        if (event.key === 'Enter' && !submitButtonDisabled) {
            await submit();
        }
    };

    const resendVerificationEmail = async () => {
        const response = await fetch('/accounts/resend_verification_email/');
        if (response.ok) {
            showToast('Verification email sent!', 'green', 2000);
        } else {
            showToast('Unable to send verification email', 'red', 2000);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-min-max gap-4">
                <div className="my-auto text-nowrap">
                    First Name:
                </div>
                <input
                    name="first_name"
                    type="text"
                    aria-label="First name input"
                    className="input w-full"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onKeyDown={(e) => submitOnEnterKey(e)}
                    data-testid="first_name_input"
                />
                <div className="my-auto text-nowrap">
                    Last Name:
                </div>
                <input
                    name="last_name"
                    type="text"
                    aria-label="Last name input"
                    className="input w-full"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onKeyDown={(e) => submitOnEnterKey(e)}
                    data-testid="last_name_input"
                />
                <div className="my-auto text-nowrap">
                    Email:
                </div>
                <div>
                    <input
                        name="email"
                        type="email"
                        autoCapitalize="off"
                        aria-label="Email address input"
                        className="input w-full"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => submitOnEnterKey(e)}
                        data-testid="email_input"
                    />
                    {userDetails.email_verified ? (
                        <div className="text-success text-sm text-center mt-2">
                            <FaCheck className="fa-inline mr-2" />
                            <span>Email verified</span>
                        </div>
                    ) : (
                        <div className="text-error text-sm text-center mt-2">
                            <span>Not verified — </span>
                            <span
                                className="underline cursor-pointer"
                                onClick={resendVerificationEmail}
                            >
                                resend email
                            </span>
                        </div>
                    )}
                </div>
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
                className="btn btn-accent mt-4"
                disabled={submitButtonDisabled}
                onClick={submit}
            >
                Save Changes
            </button>
        </div>
    );
});

UserDetails.propTypes = {
    initialUserDetails: PropTypes.shape({
        username: PropTypes.string.isRequired,
        email: PropTypes.string.isRequired,
        email_verified: PropTypes.bool.isRequired,
        first_name: PropTypes.string.isRequired,
        last_name: PropTypes.string.isRequired,
        date_joined: PropTypes.string.isRequired,
    }).isRequired
};

const ChangePassword = memo(function ChangePassword() {
    const formRef = useRef(null);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword1, setNewPassword1] = useState('');
    const [newPassword2, setNewPassword2] = useState('');
    const [oldPasswordIncorrect, setOldPasswordIncorrect] = useState(false);
    const [newPasswordError, setNewPasswordError] = useState(false);

    // Enable submit button when all fields reach minimum password length and
    // both new password fields match
    const submitButtonDisabled = oldPassword.length < 8 ||
                                 newPassword1.length < 8 ||
                                 newPassword2.length < 8 ||
                                 newPassword1 != newPassword2;

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
        if (response.ok) {
            showToast('Password changed!', 'green', 2000);
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

    const submitOnEnterKey = async (event) => {
        if (event.key === 'Enter' && !submitButtonDisabled) {
            await submit(event);
        }
    };

    return (
        <form ref={formRef} className="flex flex-col gap-2">
            <label title="Must be at least 8 characters, can't be all numbers">
                <span>Old password</span>
                <input
                    name="old_password"
                    type="password"
                    className={clsx(
                        "input w-full",
                        oldPasswordIncorrect && "border-error"
                    )}
                    value={oldPassword}
                    onKeyDown={(e) => submitOnEnterKey(e)}
                    onInput={() => setOldPasswordIncorrect(false)}
                    onChange={(e) => setOldPassword(e.target.value)}
                />
            </label>
            {oldPasswordIncorrect && (
                <span className="text-error text-center">
                    Old password incorrect
                </span>
            )}
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
            >
                Change Password
            </button>
        </form>
    );
});

const Section = ({ title, open=false, children }) => {
    return (
        <div
            className="collapse collapse-arrow bg-base-200 rounded-2xl"
            tabIndex={0}
        >
            <input
                type="radio"
                name="my-accordion-2"
                defaultChecked={open}
                aria-label={`Show ${title} form`}
            />
            <div className="collapse-title text-xl font-medium text-center p-4">
                {title}
            </div>
            <div className="collapse-content">
                {children}
            </div>
        </div>
    );
};

Section.propTypes = {
    title: PropTypes.string.isRequired,
    open: PropTypes.bool,
    children: PropTypes.node.isRequired
};

function App({ initialUserDetails }) {
    const DropdownMenuOptions = useMemo(() => (
        <>
            <li><Link to='/'>
                Overview
            </Link></li>
            <ToggleThemeOption />
        </>
    ), [ToggleThemeOption]);

    return (
        <div className="container flex flex-col full-screen mx-auto items-center">
            <Navbar
                menuOptions={DropdownMenuOptions}
                title="User Profile"
                topRightButton={<QrScannerButton />}
            />
            <div className="flex flex-col w-96 max-w-[100vw] gap-4 md:gap-6 px-4 md:mt-16">
                <Section title="Details" open={true}>
                    <UserDetails initialUserDetails={initialUserDetails} />
                </Section>
                <Section title="Change Password">
                    <ChangePassword />
                </Section>
                <Link
                    className="btn btn-soft btn-error mx-4 mb-8"
                    to="/accounts/logout/"
                >
                    Log Out
                </Link>
            </div>
        </div>
    );
}

export default App;

App.propTypes = {
    initialUserDetails: PropTypes.shape({
        username: PropTypes.string.isRequired,
        email: PropTypes.string.isRequired,
        email_verified: PropTypes.bool.isRequired,
        first_name: PropTypes.string.isRequired,
        last_name: PropTypes.string.isRequired,
        date_joined: PropTypes.string.isRequired,
    }).isRequired
};
