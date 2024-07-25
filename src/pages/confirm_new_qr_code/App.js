import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { sendPostRequest, parseDomContext } from 'src/util';
import Navbar from 'src/components/Navbar';
import PlantDetails from 'src/components/PlantDetails.js';
import GroupDetails from 'src/components/GroupDetails.js';
import { useTheme } from 'src/context/ThemeContext';
import { useErrorModal } from 'src/context/ErrorModalContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faCheck } from '@fortawesome/free-solid-svg-icons';

function App() {
    // Load UUIDs and plant/group state from django template context
    const type = parseDomContext("type");
    const instance = parseDomContext(type);
    const newUuid = parseDomContext("new_uuid");

    // Reload if user navigates to page by pressing back button (change QR code
    // request likely expired, replace with register or manage page)
    useEffect(() => {
        const handleBackButton = async (event) => {
            if (event.persisted) {
                window.location.reload();
            }
        };

        // Add listener on mount, remove on unmount
        window.addEventListener('pageshow', handleBackButton);
        return () => {
            window.removeEventListener('pageshow', handleBackButton);
        };
    }, []);

    // Get hook to show error modal
    const { showErrorModal } = useErrorModal();

    const handleConfirm = async () => {
        const response = await sendPostRequest(
            '/change_uuid',
            {
                uuid: instance.uuid,
                new_id: newUuid
            }
        );
        // Reload page if changed successfully
        if (response.ok) {
            window.location.reload();
        } else {
            const error = await response.json();
            showErrorModal(JSON.stringify(error));
        }
    };

    // Top left dropdown contents
    const DropdownOptions = () => {
        // Get toggle theme option from context
        const { ToggleThemeOption } = useTheme();

        return (
            <>
                <li><a onClick={() => window.location.href = "/"}>
                    Overview
                </a></li>
                <ToggleThemeOption />
            </>
        );
    };

    // Navbar title dropdown contents
    const Details = () => {
        const Wrapper = ({ children }) => {
            return (
                <div className={`card card-compact w-72 p-2 mt-2 mx-auto
                    shadow bg-neutral text-neutral-content`}>
                    <div className="card-body">
                        {children}
                    </div>
                </div>
            );
        };

        Wrapper.propTypes = {
            children: PropTypes.node.isRequired
        };

        switch(type) {
            case('plant'):
                return (
                    <Wrapper>
                        <PlantDetails
                            species={instance.species}
                            pot_size={instance.pot_size}
                            description={instance.description}
                        />
                    </Wrapper>
                );
            case('group'):
                return (
                    <Wrapper>
                        <GroupDetails
                            location={instance.location}
                            description={instance.description}
                        />
                    </Wrapper>
                );
        }
    };

    const Image = () => {
        return (
            <div className="mx-auto p-4 bg-base-200 rounded-3xl">
                <img
                    className="max-h-[50vh] rounded-xl object-contain"
                    src={instance.thumbnail}
                />
            </div>
        );
    };

    const Buttons = () => {
        return (
            <div className="flex gap-4 mx-auto mb-8">
                <button
                    className="btn btn-error btn-square text-white"
                    onClick={() => window.location.href = "/"}
                >
                    <FontAwesomeIcon className="h-6 w-6" icon={faXmark} />
                </button>
                <button
                    className="btn btn-success btn-square text-white"
                    onClick={handleConfirm}
                >
                    <FontAwesomeIcon className="h-6 w-6" icon={faCheck} />
                </button>
            </div>
        );
    };

    return (
        <div className="container flex flex-col mx-auto h-screen">
            <Navbar
                menuOptions={
                    <DropdownOptions />
                }
                title={instance.display_name}
                titleOptions={
                    <Details />
                }
            />

            <div className="flex flex-col gap-8 text-center my-auto">
                <p className="text-lg font-bold">
                    Is this the new QR code for your {type}?
                </p>
                {instance.thumbnail ? <Image /> : null}
                <Buttons />
            </div>
        </div>
    );
}

export default App;
