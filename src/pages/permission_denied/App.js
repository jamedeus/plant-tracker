import React, { useMemo } from 'react';
import Navbar from 'src/components/Navbar';
import { parseDomContext } from 'src/util';
import { useTheme } from 'src/context/ThemeContext';

function App() {
    const { ToggleThemeOption } = useTheme();
    const errorMessage = useMemo(() => parseDomContext('error'));

    const DropdownMenuOptions = useMemo(() => (
        <>
            <li><a onClick={() => window.location.href = "/"}>
                Overview
            </a></li>
            <ToggleThemeOption />
        </>
    ), [ToggleThemeOption]);

    return (
        <div className="container flex flex-col h-screen mx-auto items-center gap-16">
            <Navbar
                menuOptions={DropdownMenuOptions}
                title="Permission Denied"
            />

            <div className="flex flex-col text-center text-lg mt-[15vh]">
                {errorMessage}
            </div>

            <a href="/" className='btn btn-success'>
                Go to Overview
            </a>
        </div>
    );
}

export default App;
