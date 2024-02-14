import React, { useState, useEffect, useRef } from 'react';

function App() {
    // Load context set by django template
    const [context, setContext] = useState(() => {
        function parse_dom_context(name) {
            const element = document.getElementById(name);
            if (element) {
                return JSON.parse(element.textContent);
            } else {
                return "";
            }
        }

        // Parse context elements created by django template
        return {
            plants: parse_dom_context("plants"),
            trays: parse_dom_context("trays")
        };
    });
    console.log(context)

    // State object to track edit mode (shows checkbox for each card)
    const [editing, setEditing] = useState(false);

    // Toggle editing state, clear selectedRef, remove focus (closes dropdown)
    const toggleEditing = () => {
        setEditing(!editing);
        selectedRef.current = [];
        document.activeElement.blur();
    };

    // Track which card checkboxes the user has selected
    const selectedRef = useRef([]);

    // Add card UUID to selectedRef if not already present, remove if present
    const selectCard = (uuid) => {
        const oldSelected = [...selectedRef.current];
        if (oldSelected.includes(uuid)) {
            oldSelected.splice(oldSelected.indexOf(uuid), 1);
            console.log('Deleted from list');
        } else {
            oldSelected.push(uuid);
            console.log('Added to list');
        }
        console.log(oldSelected);
        selectedRef.current = oldSelected;
    };

    const CardWrapper = ({ card, editing }) => {
        switch(editing) {
            case(true):
                return (
                    <div className="flex mb-4">
                        <label className="label cursor-pointer">
                            <input
                                type="checkbox"
                                className="radio checked:bg-blue-500"
                                onClick={() => selectCard(card.key)}
                            />
                        </label>
                        <div className="ml-2 w-full">
                            {card}
                        </div>
                    </div>
                )
            case(false):
                return (
                    <div className="mb-4">
                        {card}
                    </div>
                )
        }
    };

    const CollapseCol = ({ title, children }) => {
        const [open, setOpen] = useState(true);

        const toggle = () => {
            setOpen(!open);
        };

        return (
            <div className="collapse bg-base-200 w-96 px-4 mx-auto max-w-90 md:max-w-full">
                <input type="checkbox" onChange={toggle} defaultChecked={true} />
                <div className="collapse-title text-xl font-medium text-center">
                    {title}
                </div>
                <div className="collapse-content">
                    {children.map((card) => {
                        return <CardWrapper key={card.key} card={card} editing={editing} />
                    })}
                </div>
            </div>
        );
    };

    const PlantCard = ({ name, uuid }) => {
        return (
            <div
                className="card bg-neutral text-neutral-content mx-auto w-full"
                onClick={() => window.location.href = `/manage/${uuid}`}
            >
                <div className="card-body text-center">
                    <h2 className="card-title mx-auto">{name}</h2>
                </div>
            </div>
        );
    };

    const TrayCard = ({ name, plants, uuid }) => {
        return (
            <div
                className="card bg-neutral text-neutral-content mx-auto w-full"
                onClick={() => window.location.href = `/manage/${uuid}`}
            >
                <div className="card-body text-center">
                    <h2 className="card-title mx-auto">{name}</h2>
                    <p>Contains {plants} plants</p>
                </div>
            </div>
        );
    };

    return (
        <div className="container flex flex-col mx-auto">
            <div className="navbar bg-base-100 mb-4">
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
                            <li><a onClick={toggleEditing}>Edit</a></li>
                            <li><a>Print QR Codes</a></li>
                        </ul>
                    </div>

                </div>
                <div className="navbar-center">
                    <a className="btn btn-ghost text-3xl">Plant Overview</a>
                </div>
                <div className="navbar-end">
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 mx-auto">
                <div className="md:mr-12 mb-8 md:mb-0">
                    <CollapseCol
                        title="Plants"
                        children={context.plants.map((plant) => {
                            return <PlantCard
                                key={plant.uuid}
                                name={plant.name}
                                uuid={plant.uuid}
                            />
                        })}
                    />
                </div>

                <div className="md:ml-12">
                    <CollapseCol
                        title="Trays"
                        children={context.trays.map((tray) => {
                            return <TrayCard
                                key={tray.uuid}
                                name={tray.name}
                                plants={tray.plants}
                                uuid={tray.uuid}
                            />
                        })}
                    />
                </div>
            </div>
        </div>
    );
}

export default App;
