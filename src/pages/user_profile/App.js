import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from 'src/context/ThemeContext';
import { parseDomContext, sendPostRequest } from 'src/util';
import { timestampToRelative, timestampToReadable } from 'src/timestampUtils';
import Navbar from 'src/components/Navbar';
import { showToast } from 'src/components/Toast';


const UserDetails = () => {
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
            <div className="grid grid-cols-2 gap-4">
                <div className="my-auto">First Name:</div>
                <input
                    name="first_name"
                    type="text"
                    className="input w-full input-bordered"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                />
                <div className="my-auto">Last Name:</div>
                <input
                    name="last_name"
                    type="text"
                    className="input w-full input-bordered"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                />
                <div className="my-auto">Email:</div>
                <input
                    name="email"
                    type="text"
                    className="input w-full input-bordered"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <div className="my-auto">Date joined:</div>
                <div className="flex flex-col text-center">
                    <span>
                        {timestampToReadable(userDetails.date_joined).split('-')[1]}
                    </span>
                    <span>
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
            <div className="flex flex-col max-w-96 gap-8 p-4 md:mt-16">
                <UserDetails />

                <a className="btn btn-info" href="/accounts/change_password">
                    Change Password
                </a>
                <a className="btn btn-info" href="/accounts/logout/">
                    Log Out
                </a>
            </div>
        </div>
    );
}

export default App;
