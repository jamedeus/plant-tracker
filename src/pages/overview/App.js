import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import Navbar from 'src/components/Navbar';
import { useTheme } from 'src/context/ThemeContext';
import GroupCard from 'src/components/GroupCard';
import PlantCard from 'src/components/PlantCard';
import { sendPostRequest, parseDomContext } from 'src/util';
import FilterColumn from 'src/components/FilterColumn';
import FloatingFooter from 'src/components/FloatingFooter';
import Setup from './Setup';
import PrintModal from './PrintModal';
import { useIsBreakpointActive } from "src/useBreakpoint";
import clsx from 'clsx';

const PlantsCol = ({ plants, editing, selectedPlants }) => {
    const openRef = useRef(true);

    return (
        <FilterColumn
            title="Plants"
            contents={plants}
            CardComponent={PlantCard}
            editing={editing}
            selected={selectedPlants}
            openRef={openRef}
            ignoreKeys={[
                'uuid',
                'created',
                'last_watered',
                'last_fertilized',
                'thumbnail'
            ]}
            sortByKeys={[
                {key: 'created', display: 'Added'},
                {key: 'display_name', display: 'Name'},
                {key: 'species', display: 'Species'},
                {key: 'last_watered', display: 'Watered'}
            ]}
            defaultSortKey='created'
            storageKey='overviewPlantsColumn'
        />
    );
};

PlantsCol.propTypes = {
    plants: PropTypes.array.isRequired,
    editing: PropTypes.bool.isRequired,
    selectedPlants: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired
}

const GroupsCol = ({ groups, editing, selectedGroups }) => {
    const openRef = useRef(true);

    return (
        <FilterColumn
            title="Groups"
            contents={groups}
            CardComponent={GroupCard}
            editing={editing}
            selected={selectedGroups}
            openRef={openRef}
            ignoreKeys={[
                'uuid',
                'created'
            ]}
            sortByKeys={[
                {key: 'created', display: 'Added'},
                {key: 'name', display: 'Name'},
                {key: 'location', display: 'Location'}
            ]}
            defaultSortKey='created'
            storageKey='overviewGroupsColumn'
        />
    );
};

GroupsCol.propTypes = {
    groups: PropTypes.array.isRequired,
    editing: PropTypes.bool.isRequired,
    selectedGroups: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired
}

// Render correct components for current state objects
const Layout = ({ plants, groups, selectedPlants, selectedGroups, editing, plantsColRef, groupsColRef, printModalRef }) => {
    // Determines if 2-column layout or single centered column
    const twoColumns = plants.length > 0 && groups.length > 0;

    return (
        <div className={clsx(
            'grid grid-cols-1 mx-auto',
            twoColumns && 'md:grid-cols-2'
        )}>
            {/* Render plants column if 1 or more plants exist */}
            {plants.length > 0 && (
                <div
                    className={clsx(
                        'scroll-mt-20',
                        twoColumns && 'md:mr-12 mb-8 md:mb-0'
                    )}
                    ref={plantsColRef}
                >
                    <PlantsCol
                        plants={plants}
                        editing={editing}
                        selectedPlants={selectedPlants}
                    />
                </div>
            )}
            {/* Render groups column if 1 or more groups exist */}
            {groups.length > 0 && (
                <div
                    className={clsx(
                        'scroll-mt-20',
                        twoColumns && 'md:ml-12'
                    )}
                    ref={groupsColRef}
                >
                    <GroupsCol
                        groups={groups}
                        editing={editing}
                        selectedGroups={selectedGroups}
                    />
                </div>
            )}
            {/* Render setup instructions if database is empty */}
            {plants.length === 0 && groups.length === 0 && (
                <Setup printModalRef={printModalRef} />
            )}
        </div>
    )
};

Layout.propTypes = {
    plants: PropTypes.array.isRequired,
    groups: PropTypes.array.isRequired,
    selectedPlants: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired,
    selectedGroups: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired,
    editing: PropTypes.bool.isRequired,
    plantsColRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired,
    groupsColRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired,
    printModalRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired
}

// Dropdown with links to jump to plant or group columns
// Only rendered on mobile layout (both columns always visible on desktop)
const QuickNavigation = ({ plantsColRef, groupsColRef }) => {
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
            className={`menu menu-md dropdown-content mt-3 z-[99] p-2 shadow
                        bg-base-300 rounded-box w-24`}
        >
            <li className="mx-auto"><a onClick={jumpToPlants}>
                Plants
            </a></li>
            <li className="mx-auto"><a onClick={jumpToGroups}>
                Groups
            </a></li>
        </ul>
    );
};

QuickNavigation.propTypes = {
    groupsColRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired,
    printModalRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.array }),
    ]).isRequired
}

// Top-left menu button contents
const MenuOptions = ({ archivedOverview, toggleEditing, openPrintModal }) => {
    // Get toggle theme option from context
    const { ToggleThemeOption } = useTheme();

    switch(archivedOverview) {
        case(true):
            return (
                <>
                    <li><a onClick={toggleEditing}>
                        Edit
                    </a></li>
                    <ToggleThemeOption />
                    <li><a href='/'>
                        Main overview
                    </a></li>
                </>
            );
        case(false):
            return (
                <>
                    <li><a onClick={toggleEditing}>
                        Edit
                    </a></li>
                    <li><a onClick={openPrintModal}>
                        Print QR Codes
                    </a></li>
                    <ToggleThemeOption />
                    <li><a href='/archived'>
                        Archived plants
                    </a></li>
                </>
            );
    }
};

MenuOptions.propTypes = {
    archivedOverview: PropTypes.bool.isRequired,
    toggleEditing: PropTypes.func.isRequired,
    openPrintModal: PropTypes.func.isRequired
}

function App() {
    // Load context set by django template
    const [plants, setPlants] = useState(() => {
        return parseDomContext("plants");
    });
    const [groups, setGroups] = useState(() => {
        return parseDomContext("groups");
    });

    // True if desktop layout, false if mobile
    const desktop = useIsBreakpointActive('md');
    // True if mobile layout with stacked plant and group columns
    // False if desktop layout (side by side columns) or only one column
    const stackedColumns = !desktop && plants.length > 0 && groups.length > 0;

    // Check URL to determine if viewing main overview or archive overview
    const archivedOverview = window.location.pathname === '/archived';

    // Request new state from backend if user navigates to overview by pressing
    // back button (last watered/details may be outdated if coming from manage)
    useEffect(() => {
        const handleBackButton = async (event) => {
            if (event.persisted) {
                const response = await fetch('/get_overview_state');
                if (response.ok) {
                    const data = await response.json();
                    setPlants(data['plants']);
                    setGroups(data['groups']);
                } else {
                    alert('Failed to fetch current state, page may be outdated');
                }
            }
        };

        // Add listener on mount, remove on unmount
        if (!archivedOverview) {
            window.addEventListener('pageshow', handleBackButton);
            return () => {
                window.removeEventListener('pageshow', handleBackButton);
            };
        }
    }, []);

    // Create ref for modal used to generate QR codes
    const printModalRef = useRef(null);

    // State object to track edit mode (shows checkbox for each card when true)
    const [editing, setEditing] = useState(false);

    // Track which plant and group checkboxes the user has selected
    const selectedPlants = useRef([]);
    const selectedGroups = useRef([]);

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

    // Handler for archive button (main overview) and un-archive button
    // (archive overview) that appear while editing. POSTS selected plants and
    // groups to backend then removes from frontend state.
    // Takes bool argument (true if archiving, false if un-archiving)
    const handleArchive = (archived) => {
        // Send archive request for each selected plant, remove uuid from state
        selectedPlants.current.forEach(async plant_id => {
            await sendPostRequest(
                '/archive_plant',
                {plant_id: plant_id, archived: archived}
            );
        });
        setPlants(plants.filter(
            plant => !selectedPlants.current.includes(plant.uuid))
        );

        // Send archive request for each selected group, remove uuid from state
        selectedGroups.current.forEach(async group_id => {
            await sendPostRequest(
                '/archive_group',
                {group_id: group_id, archived: archived}
            );
        });
        setGroups(groups.filter(
            group => !selectedGroups.current.includes(group.uuid))
        );

        // Reset editing state
        setEditing(false);
    };

    return (
        <div className="container flex flex-col min-h-screen mx-auto pb-16">
            <Navbar
                menuOptions={<MenuOptions
                    archivedOverview={archivedOverview}
                    toggleEditing={toggleEditing}
                    openPrintModal={() => printModalRef.current.open()}
                />}
                title={archivedOverview ? "Archived" : "Plant Overview"}
                titleOptions={stackedColumns ? (
                    <QuickNavigation
                        plantsColRef={plantsColRef}
                        groupsColRef={groupsColRef}
                    />
                ) : null}
            />

            <Layout
                plants={plants}
                groups={groups}
                selectedPlants={selectedPlants}
                selectedGroups={selectedGroups}
                editing={editing}
                plantsColRef={plantsColRef}
                groupsColRef={groupsColRef}
                printModalRef={printModalRef}
            />

            <FloatingFooter visible={editing}>
                <button className="btn btn-neutral mr-4" onClick={() => setEditing(false)}>
                    Cancel
                </button>
                {archivedOverview ? (
                    <button className="btn mx-4" onClick={() => handleArchive(false)}>
                        Un-archive
                    </button>
                ) : (
                    <button className="btn mx-4" onClick={() => handleArchive(true)}>
                        Archive
                    </button>
                )}
                <button className="btn btn-error ml-4" onClick={handleDelete}>
                    Delete
                </button>
            </FloatingFooter>

            <PrintModal ref={printModalRef} />
        </div>
    );
}

export default App;
