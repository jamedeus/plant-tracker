import React from 'react';

// Renders navbar with dropdown on left, centered title, optional right section
// dropdownOptions must be list of <li> elements, other args can be anything
const Navbar = ({ dropdownOptions, title, rightSection }) => {
    return (
        <div className="navbar bg-base-100 mb-4 sticky top-0 z-[99]">
            <div className="navbar-start">
                <div className="dropdown">
                    <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 6h16M4 12h16M4 18h7"
                            />
                        </svg>
                    </div>
                    <ul tabIndex={0} className="menu menu-md dropdown-content mt-3 z-[99] p-2 shadow bg-base-300 rounded-box w-52">
                        {dropdownOptions}
                    </ul>
                </div>
            </div>

            <div className="navbar-center">
                {title}
            </div>

            <div className="navbar-end">
                {rightSection}
            </div>
        </div>
    );
};

export default Navbar;
