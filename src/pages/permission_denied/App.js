import React from 'react';
import PropTypes from 'prop-types';
import SmartLink from 'src/components/SmartLink';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';

function App({ errorMessage }) {
    return (
        <div className="container flex flex-col full-screen mx-auto items-center gap-16">
            <Navbar
                menuOptions={<NavbarDropdownOptions />}
                title="Permission Denied"
                showScanButton={false}
            />

            <div className="flex flex-col text-center text-lg mt-[15vh]">
                {errorMessage}
            </div>

            <SmartLink to="/" className='btn btn-accent'>
                Go to Overview
            </SmartLink>
        </div>
    );
}

export default App;

App.propTypes = {
    errorMessage: PropTypes.string.isRequired
};
