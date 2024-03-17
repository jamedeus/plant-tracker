import React, { useState, useRef } from 'react';
import Navbar from 'src/components/Navbar';
import { useTheme } from 'src/context/ThemeContext';
import TrayCard from 'src/components/TrayCard';
import PlantCard from 'src/components/PlantCard';
import { sendPostRequest, parseDomContext } from 'src/util';
import FilterColumn from 'src/components/FilterColumn';
import FloatingFooter from 'src/components/FloatingFooter';
import PrintModal from './PrintModal';

function App() {
    // Load context set by django template
    const [plants, setPlants] = useState(() => {
        return parseDomContext("plants");
    });
    const [trays, setTrays] = useState(() => {
        return parseDomContext("trays");
    });

    // Create ref for modal used to generate QR codes
    const printModalRef = useRef(null);

    const showPrintModal = () => {
        if (printModalRef.current) {
            printModalRef.current.showModal();
        }
    };

    // Get toggle theme option from context
    const { ToggleThemeOption } = useTheme();

    // State object to track edit mode (shows checkbox for each card when true)
    const [editing, setEditing] = useState(false);

    // Track which plant and tray checkboxes the user has selected
    const selectedPlants = useRef([]);
    const selectedTrays = useRef([]);

    // Handler for edit option in top-left dropdown
    // Toggle editing state, clear selected, remove focus (closes dropdown)
    const toggleEditing = () => {
        setEditing(!editing);
        selectedPlants.current = [];
        selectedTrays.current = [];
        document.activeElement.blur();
    };

    // Handler for delete button that appears while editing
    const handleDelete = () => {
        // Send delete request for each selected plant, remove uuid from state
        selectedPlants.current.forEach(async plant_id => {
            await sendPostRequest('/delete_plant', {plant_id: plant_id});
        });
        setPlants(plants.filter(plant => !selectedPlants.current.includes(plant.uuid)));

        // Send delete request for each selected tray, remove uuid from state
        selectedTrays.current.forEach(async tray_id => {
            await sendPostRequest('/delete_tray', {tray_id: tray_id});
        });
        setTrays(trays.filter(tray => !selectedTrays.current.includes(tray.uuid)));

        // Reset editing state
        setEditing(false);
    };

    // Rendered when both state objects are empty, shows setup instructions
    const Setup = () => {
        return (
            <div className="flex flex-col mx-auto text-center my-auto px-8">
                <p className="text-2xl">No plants found!</p>
                <ul className="steps steps-vertical my-8">
                    <li className="step">Print QR codes on sticker paper</li>
                    <li className="step">Add a sticker to each plant pot</li>
                    <li className="step">Scan codes to register plants!</li>
                </ul>
                <button
                    className="btn btn-accent text-lg"
                    onClick={showPrintModal}
                >
                    Print QR Codes
                </button>
            </div>
        );
    };

    const PlantsCol = () => {
        return (
            <FilterColumn
                title="Plants"
                contents={plants}
                cardComponent={PlantCard}
                editing={editing}
                selected={selectedPlants}
            />
        );
    };

    const TraysCol = () => {
        return (
            <FilterColumn
                title="Trays"
                contents={trays}
                cardComponent={TrayCard}
                editing={editing}
                selected={selectedTrays}
            />
        );
    };

    // Render correct components for current state objects
    const Layout = () => {
        switch(true) {
            // Render 2-column layout if both plants and trays exist
            case(plants.length > 0 && trays.length > 0):
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 mx-auto">
                        <div className="md:mr-12 mb-8 md:mb-0">
                            <PlantsCol />
                        </div>

                        <div className="md:ml-12">
                            <TraysCol />
                        </div>
                    </div>
                );
            // Render centered plants column if only plants exist
            case(plants.length > 0):
                return <PlantsCol />;
            // Render centered trays column if only trays exist
            case(trays.length > 0):
                return <TraysCol />;
            // Render setup instructions if database is empty
            default:
                return <Setup />;
        }
    };

    return (
        <div className="container flex flex-col min-h-screen mx-auto pb-16">
            <Navbar
                dropdownOptions={
                    <>
                        <li><a onClick={toggleEditing}>Edit</a></li>
                        <li><a onClick={showPrintModal}>Print QR Codes</a></li>
                        <ToggleThemeOption />
                    </>
                }
                title={
                    <a className="btn btn-ghost text-3xl">Plant Overview</a>
                }
            />

            <Layout />

            <FloatingFooter visible={editing}>
                <button className="btn mr-4" onClick={() => setEditing(false)}>
                    Cancel
                </button>
                <button className="btn btn-error ml-4" onClick={handleDelete}>
                    Delete
                </button>
            </FloatingFooter>

            <PrintModal printModalRef={printModalRef} />
        </div>
    );
}

export default App;
