import React, { useMemo } from 'react';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';
import { parseDomContext } from 'src/util';

function App() {
    const errorMessage = useMemo(() => parseDomContext('error'));

    return (
        <div className="container flex flex-col h-screen mx-auto items-center gap-16">
            <Navbar
                menuOptions={<NavbarDropdownOptions />}
                title="Permission Denied"
            />

            <div className="flex flex-col text-center text-lg mt-[15vh]">
                {errorMessage}
            </div>

            <a href="/" className='btn btn-accent'>
                Go to Overview
            </a>
        </div>
    );
}

export default App;
