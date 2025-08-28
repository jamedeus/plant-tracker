import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';

function App({ errorMessage }) {
    return (
        <div
            className="container flex flex-col full-screen mx-auto items-center gap-16"
            data-testid="error-page"
        >
            <Navbar
                menuOptions={<NavbarDropdownOptions />}
                title="Error"
                showScanButton={false}
            />

            <div className="flex flex-col text-center text-lg mt-[15vh]">
                {errorMessage}
            </div>

            <Link to="/" className='btn btn-accent' discover="none">
                Go to Overview
            </Link>
        </div>
    );
}

export default App;

App.propTypes = {
    errorMessage: PropTypes.string.isRequired
};
