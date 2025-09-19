import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Navbar from 'src/components/Navbar';
import NavbarDropdownOptions from 'src/components/NavbarDropdownOptions';
import DropdownMenu from 'src/components/DropdownMenu';
import TitleDrawer from 'src/components/TitleDrawer';
import GroupDetails from 'src/components/GroupDetails';
import PlantsCol from 'src/components/PlantsCol';
import RemovePlantsFooter from './RemovePlantsFooter';
import AddEventsFooter from 'src/components/AddEventsFooter';
import LazyModal, { useModal } from 'src/components/LazyModal';
import QrScannerButton from 'src/components/QrScannerButton';
import { Tab } from '@headlessui/react';
import { FaPlus } from 'react-icons/fa6';
import clsx from 'clsx';
import 'src/css/index.css';
import { updatePlantLastEventTimes } from './groupSlice';
import EventButtons from './EventButtons';

function Layout() {
    const dispatch = useDispatch();
    const groupDetails = useSelector((state) => state.group.groupDetails);
    const plantDetails = useSelector((state) => state.group.plantDetails);

    // Hide event buttons if no plants in group
    const noPlants = Object.keys(plantDetails).length === 0;

    // Controls navbar TitleDrawer open/close state
    const [titleDrawerOpen, setTitleDrawerOpen] = useState(false);
    const toggleTitleDrawerOpen = useCallback(() => {
        setTitleDrawerOpen(!titleDrawerOpen);
    }, [titleDrawerOpen]);
    const closeTitleDrawer = useCallback(() => {
        setTitleDrawerOpen(false);
    }, []);

    // Buttons add events to all plants if 0, only selected plants if 1
    // Set with tabs above event timestamp input
    const [addEventsMode, setAddEventsMode] = useState(0);

    // Controls whether FloatingFooter with remove from group button is visible
    const [removingPlants, setRemovingPlants] = useState(false);

    // Hide event buttons if no plants OR selecting plants to remove/add events
    const hideEventButtons = addEventsMode || removingPlants || noPlants;

    // Show RemovePlantsFooter, hide AddEventsFooter, close dropdown menu
    const startRemovingPlants = useCallback(() => {
        setRemovingPlants(true);
        stopAddingEvents();
        document.activeElement.blur();
    }, []);

    // Hide RemovePlantsFooter
    const stopRemovingPlants = useCallback(() => {
        setRemovingPlants(false);
    }, []);

    const stopAddingEvents = useCallback(() => {
        setAddEventsMode(0);
    }, []);

    // FormRef for FilterColumn used to add events to subset of plants in group
    const selectedPlantsRef = useRef(null);

    // Handler for AddEventsFooter buttons
    const handleAddEvents = useCallback((payload) => {
        dispatch(updatePlantLastEventTimes(payload));
    }, [dispatch]);

    const editModal = useModal();
    const openEditModal = useCallback(() => {
        editModal.open();
        document.activeElement.blur();
    }, [editModal]);

    const changeQrModal = useModal();
    const openChangeQrModal = useCallback(() => {
        changeQrModal.open({uuid: groupDetails.uuid});
        document.activeElement.blur();
    }, [changeQrModal]);

    const addPlantsModal = useModal();
    const openAddPlantsModal = useCallback(() => {
        addPlantsModal.open();
        document.activeElement.blur();
    }, [addPlantsModal]);

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => (
        <NavbarDropdownOptions />
    ), []);

    const PlantsColTitleOptions = useMemo(() => (
        <DropdownMenu>
            <li><a
                className="flex justify-center"
                onClick={openAddPlantsModal}
                data-testid="add_plants_option"
            >
                Add
            </a></li>
            <li><a
                className="flex justify-center"
                onClick={startRemovingPlants}
                data-testid="remove_plants_option"
            >
                Remove
            </a></li>
        </DropdownMenu>
    ), []);

    return (
        <div
            className="container flex flex-col items-center mx-auto mb-28"
            data-testid="manage-group-layout"
        >
            <Navbar
                menuOptions={DropdownMenuOptions}
                title={groupDetails.display_name}
                onTitleClick={toggleTitleDrawerOpen}
                topRightButton={<QrScannerButton />}
            />

            <TitleDrawer open={titleDrawerOpen} onClose={closeTitleDrawer}>
                <div className="divider font-bold">
                    Details
                </div>
                <div className='min-w-full'>
                    <GroupDetails
                        created={groupDetails.created}
                        location={groupDetails.location}
                        description={groupDetails.description}
                    />
                </div>
                <button className="btn h-8 mt-4 w-full" onClick={openEditModal}>
                    Edit Details
                </button>
                <button className="btn h-8 mt-4 w-full" onClick={openChangeQrModal}>
                    Change QR Code
                </button>
            </TitleDrawer>

            {/* Don't render event buttons if group is archived */}
            {groupDetails.archived ? (
                <div className="text-center text-xl mb-8">
                    Group Archived
                </div>
            ) : (
                <div className={clsx(
                    "flex flex-col items-center transition-[height] duration-300",
                    hideEventButtons ? "h-0" : "h-[14.25rem]"
                )}>
                    <Tab.Group
                        selectedIndex={addEventsMode}
                        onChange={(index) => setAddEventsMode(index)}
                    >
                        <Tab.List className="tab-group my-2 w-64">
                            <Tab className={({ selected }) => clsx(
                                'tab-option whitespace-nowrap',
                                selected && 'tab-option-selected'
                            )}>
                                All plants
                            </Tab>
                            <Tab className={({ selected }) => clsx(
                                'tab-option whitespace-nowrap',
                                selected && 'tab-option-selected'
                            )}>
                                Select plants
                            </Tab>
                        </Tab.List>
                    </Tab.Group>

                    <EventButtons />
                </div>
            )}


            <div className="px-4 relative">
                <PlantsCol
                    plants={plantDetails}
                    editing={Boolean(addEventsMode) || removingPlants}
                    formRef={selectedPlantsRef}
                    storageKey={`group-${groupDetails.uuid}`}
                    // Render dropdown with add/remove options unless no plants
                    titleOptions={noPlants ? null : PlantsColTitleOptions}
                >
                    {/* Render message and add plants button if no plants */}
                    {noPlants && (
                        <>
                            <span className="text-center font-semibold my-2">
                                No plants!
                            </span>
                            <button
                                className="btn btn-accent mx-auto mt-4"
                                onClick={openAddPlantsModal}
                                data-testid="add_plants_button"
                            >
                                <FaPlus className="size-5 mr-1" /> Add plants
                            </button>
                        </>
                    )}
                </PlantsCol>
            </div>

            <AddEventsFooter
                visible={Boolean(addEventsMode)}
                onClose={stopAddingEvents}
                selectedPlantsRef={selectedPlantsRef}
                plants={plantDetails}
                updatePlantLastEventTimes={handleAddEvents}
            />

            <RemovePlantsFooter
                visible={removingPlants}
                selectedPlantsRef={selectedPlantsRef}
                stopRemovingPlants={stopRemovingPlants}
            />

            <LazyModal
                ref={editModal.ref}
                title="Edit Details"
                ariaLabel="Edit group details"
                className="max-w-[25rem]"
                load={() => import(/* webpackChunkName: "manage_group_edit-modal" */ "./EditGroupModal")}
            />

            <LazyModal
                ref={changeQrModal.ref}
                title="Change QR Code"
                ariaLabel="Change group QR code"
                load={() => import(/* webpackChunkName: "change-qr-modal" */ "src/components/ChangeQrModal")}
            />

            <LazyModal
                ref={addPlantsModal.ref}
                title="Add Plants"
                ariaLabel="Add plants"
                load={() => import(/* webpackChunkName: "manage_group_add-plants-modal" */ "./AddPlantsModal")}
            />
        </div>
    );
}

export default Layout;
