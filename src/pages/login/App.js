import React, { useState, useMemo } from 'react';
import Navbar from 'src/components/Navbar';
import { useTheme } from 'src/context/ThemeContext';
import Cookies from 'js-cookie';

function App() {
    const { ToggleThemeOption } = useTheme();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

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

            <form
                method="post"
                action="/accounts/login/"
                className="flex flex-col gap-4 mt-[15vh]"
            >
                <input
                    type="hidden"
                    name="csrfmiddlewaretoken"
                    value={Cookies.get("csrftoken")}
                />
                <label className="form-control w-full">
                    <div className="label">
                        <span className="label-text">Username</span>
                    </div>
                    <input
                        name="username"
                        type="text"
                        className="input w-full input-bordered"
                        value={username}
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
                        className="input w-full input-bordered"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                </label>

                <button
                    className="btn btn-success mt-6"
                >
                    Login
                </button>
            </form>
        </div>
    );
}

export default App;
