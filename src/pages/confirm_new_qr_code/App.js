import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { sendPostRequest, parseDomContext } from 'src/util';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';
import PlantDetails from 'src/components/PlantDetails.js';
import GroupDetails from 'src/components/GroupDetails.js';
import { openErrorModal } from 'src/components/ErrorModal';
import { FaXmark, FaCheck } from 'react-icons/fa6';

const Layout = ({ type, previewUrl, previewAltText, handleConfirm }) => {
    return (
        <div className="flex flex-col gap-8 text-center my-auto">
            <p className="text-lg font-bold">
                Is this the new QR code for your {type}?
            </p>
            {previewUrl && (
                <div className="mx-auto p-4 bg-base-200 rounded-3xl">
                    <img
                        className="max-h-[50vh] rounded-xl object-contain"
                        src={previewUrl}
                        alt={previewAltText}
                        draggable={false}
                    />
                </div>
            )}

            {/* Confirm/cancel buttons */}
            <div className="flex gap-4 mx-auto mb-8">
                <a
                    className="btn h-12 btn-error btn-square text-white"
                    role="button"
                    href="/"
                    title="Don't change QR code"
                >
                    <FaXmark className="size-6" />
                </a>
                <button
                    className="btn h-12 btn-success btn-square text-white"
                    onClick={handleConfirm}
                    title="Change QR code"
                >
                    <FaCheck className="size-6" />
                </button>
            </div>
        </div>
    );
};

Layout.propTypes = {
    type: PropTypes.oneOf([
        'plant',
        'group'
    ]).isRequired,
    previewUrl: PropTypes.string,
    previewAltText: PropTypes.string,
    handleConfirm: PropTypes.func.isRequired
};

function App() {
    // Load UUIDs and plant/group state from django template context
    const type = parseDomContext("type");
    const instance = parseDomContext("instance");
    const preview = parseDomContext("preview");
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
            openErrorModal(JSON.stringify(error));
        }
    };

    // Plant/group details card shown when title is clicked
    const DetailsDropdown = useMemo(() => (
        <div className="details-card">
            <div className="card-body">
                {type === 'plant' ? (
                    <PlantDetails
                        species={instance.species}
                        pot_size={instance.pot_size}
                        description={instance.description}
                    />
                ) : (
                    <GroupDetails
                        location={instance.location}
                        description={instance.description}
                    />
                )}
            </div>
        </div>
    ), []);

    return (
        <div className="container flex flex-col items-center mx-auto full-screen">
            <Navbar
                menuOptions={<NavbarDropdownOptions />}
                title={instance.display_name}
                titleOptions={DetailsDropdown}
            />
            <Layout
                type={type}
                previewUrl={preview}
                previewAltText={`${instance.display_name} photo`}
                handleConfirm={handleConfirm}
            />
        </div>
    );
}

export default App;
