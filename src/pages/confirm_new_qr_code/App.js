import React from 'react';
import { sendPostRequest, parseDomContext } from 'src/util';
import Navbar from 'src/components/Navbar';
import { useToast } from 'src/context/ToastContext';
import { useTheme } from 'src/context/ThemeContext';
import { useErrorModal } from 'src/context/ErrorModalContext';

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

    const handleCancel = () => {
        alert('not implemented');
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

    return (
        <div className="container flex flex-col mx-auto mb-8">
            <Navbar
                menuOptions={
                    <DropdownOptions />
                }
                title={plant.display_name}
            />

            <div className="flex flex-col text-center">
                <p className="text-xl font-bold">Confirm new QR code?</p>
                <div className="flex gap-4 mx-auto">
                    <button className="btn btn-error" onClick={handleCancel}>
                        Cancel
                    </button>
                    <button className="btn btn-success" onClick={handleConfirm}>
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

export default App;
