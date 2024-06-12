import React, { useState, useRef } from 'react';
import Navbar from 'src/components/Navbar';
import { useTheme } from 'src/context/ThemeContext';
import GroupCard from 'src/components/GroupCard';
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
    const [groups, setGroups] = useState(() => {
        return parseDomContext("groups");
    });

    // Request new state from backend if user navigates to overview by pressing
    // back button (last watered/details may be outdated if coming from manage)
    window.addEventListener('pageshow', async (event) => {
        if (event.persisted) {
            const response = await fetch('/get_overview_state');
            const data = await response.json();
            setPlants(data['plants']);
            setGroups(data['groups']);
        }
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

    // Track which plant and group checkboxes the user has selected
    const selectedPlants = useRef([]);
    const selectedGroups = useRef([]);

    // Track plant and group column open state between re-renders
    const plantsOpenRef = useRef(true);
    const groupsOpenRef = useRef(true);

    // Refs used to jump to top of plant and group columns
    const plantsColRef = useRef(null);
    const groupsColRef = useRef(null);

    // Handler for edit option in top-left dropdown
    // Toggle editing state, clear selected, remove focus (closes dropdown)
    const toggleEditing = () => {
        setEditing(!editing);
        selectedPlants.current = [];
        selectedGroups.current = [];
        document.activeElement.blur();
    };

    // Handler for delete button that appears while editing
    const handleDelete = () => {
        // Send delete request for each selected plant, remove uuid from state
        selectedPlants.current.forEach(async plant_id => {
            await sendPostRequest('/delete_plant', {plant_id: plant_id});
        });
        setPlants(plants.filter(
            plant => !selectedPlants.current.includes(plant.uuid))
        );

        // Send delete request for each selected group, remove uuid from state
        selectedGroups.current.forEach(async group_id => {
            await sendPostRequest('/delete_group', {group_id: group_id});
        });
        setGroups(groups.filter(
            group => !selectedGroups.current.includes(group.uuid))
        );

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
                CardComponent={PlantCard}
                editing={editing}
                selected={selectedPlants}
                openRef={plantsOpenRef}
                ignoreKeys={[
                    'uuid',
                    'last_watered',
                    'last_fertilized',
                    'thumbnail'
                ]}
            />
        );
    };

    const GroupsCol = () => {
        return (
            <FilterColumn
                title="Groups"
                contents={groups}
                CardComponent={GroupCard}
                editing={editing}
                selected={selectedGroups}
                openRef={groupsOpenRef}
                ignoreKeys={['uuid']}
            />
        );
    };

    // Render correct components for current state objects
    const Layout = () => {
        switch(true) {
            // Render 2-column layout if both plants and groups exist
            case(plants.length > 0 && groups.length > 0):
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 mx-auto">
                        <div
                            className="md:mr-12 mb-8 md:mb-0 scroll-mt-20"
                            ref={plantsColRef}
                        >
                            <PlantsCol />
                        </div>

                        <div
                            className="md:ml-12 scroll-mt-20"
                            ref={groupsColRef}
                        >
                            <GroupsCol />
                        </div>
                    </div>
                );
            // Render centered plants column if only plants exist
            case(plants.length > 0):
                return <PlantsCol />;
            // Render centered groups column if only groups exist
            case(groups.length > 0):
                return <GroupsCol />;
            // Render setup instructions if database is empty
            default:
                return <Setup />;
        }
    };

    // Renders dropdown used to jump to plants or groups column if both present
    const QuickNavigation = () => {
        if (plants.length > 0 && groups.length > 0) {
            const jumpToPlants = () => {
                plantsColRef.current.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
                document.activeElement.blur();
            };

            const jumpToGroups = () => {
                groupsColRef.current.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
                document.activeElement.blur();
            };

            return (
                <ul
                    tabIndex={0}
                    className={`menu menu-md dropdown-content mt-3 z-[99]
                                p-2 shadow bg-base-300 rounded-box w-24`}
                >
                    <li className="mx-auto"><a onClick={jumpToPlants}>
                        Plants
                    </a></li>
                    <li className="mx-auto"><a onClick={jumpToGroups}>
                        Groups
                    </a></li>
                </ul>
            );
        } else {
            return null;
        }
    };

    return (
        <div className="container flex flex-col min-h-screen mx-auto pb-16">
            <Navbar
                menuOptions={
                    <>
                        <li><a onClick={toggleEditing}>Edit</a></li>
                        <li><a onClick={showPrintModal}>Print QR Codes</a></li>
                        <ToggleThemeOption />
                    </>
                }
                title={"Plant Overview"}
                titleOptions={<QuickNavigation />}
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
