import React from 'react';
import { sendPostRequest, parseDomContext } from 'src/util';
import Navbar from 'src/components/Navbar';
import { useToast } from 'src/context/ToastContext';
import { useTheme } from 'src/context/ThemeContext';
import { useErrorModal } from 'src/context/ErrorModalContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faCheck } from '@fortawesome/free-solid-svg-icons';

function App() {
    // Load UUIDs from django template context
    const plant = parseDomContext("plant");
    const newUuid = parseDomContext("new_uuid");

    // Get hooks to show toast message, error modal
    const { showToast } = useToast();
    const { showErrorModal } = useErrorModal();

    const handleConfirm = async () => {
        const response = await sendPostRequest(
            '/change_plant_uuid',
            {
                plant_id: plant.uuid,
                new_id: newUuid
            }
        );
        // Reload page if changed successfully
        if (response.ok) {
            window.location.reload();
        } else {
            alert('failed')
        }
    };

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

    const Image = () => {
        return (
            <div className="mx-auto p-4 bg-base-200 rounded-3xl">
                <img
                    className="max-h-[50vh] rounded-xl object-contain"
                    src={plant.thumbnail}
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
                title={plant.display_name}
            />

            <div className="flex flex-col gap-8 text-center my-auto">
                <p className="text-lg font-bold">
                    Is this the new QR code for your plant?
                </p>
                <Image />
                <Buttons />
            </div>
        </div>
    );
}

export default App;
