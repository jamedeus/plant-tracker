import React, { Fragment, useState } from 'react';
import { Combobox, Transition } from '@headlessui/react'

const SpeciesSelect = ({ value, species_options }) => {
    // State for current input value
    const [query, setQuery] = useState('');

    // State for selected option (start with default value)
    const [selected, setSelected] = useState(value);

    const filteredOptions =
        query === ''
            ? species_options
            : species_options.filter((option) => {
                    return option.toLowerCase().includes(query.toLowerCase())
                })

    const Option = ({ value, text }) => {
        return (
            <Combobox.Option
                value={value}
                className={({ active }) =>
                    `combobox-option ${
                        active ? 'bg-teal-600' : ''
                    }`
                }
            >
                {text}
            </Combobox.Option>
        )
    }

    return (
        <Combobox value={selected} onChange={setSelected} nullable>
            <Combobox.Input
                name="species"
                className="input w-full input-bordered"
                onChange={(event) => {
                    // Set both so value doesn't reset when focus lost
                    // Allows adding new value without clicking "Create" option
                    setQuery(event.target.value);
                    setSelected(event.target.value);
                }}
                autoComplete="off"
            />
            <Transition
                as={Fragment}
                enter="transition ease-in duration-100"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
            >
                <Combobox.Options className="combobox-options-div">
                    {/* Add option if current input not in species_options */}
                    {query.length > 0 && !species_options.includes(query) && (
                        <Option value={query} text={`Create "${query}"`} />
                    )}
                    {/* Add option for each string in filteredOptions */}
                    {filteredOptions.map((option) => (
                        <Option key={option} value={option} text={option} />
                    ))}
                </Combobox.Options>
            </Transition>
        </Combobox>
    )
}


const PlantDetails = ({ name, species, pot_size, description, species_options }) => {
    return (
        <form id="plantDetails">
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text-alt">Plant name</span>
                </div>
                <input
                    name="name"
                    type="text"
                    className="input w-full input-bordered"
                    defaultValue={name}
                />
            </label>
            <label className="form-control w-full relative">
                <div className="label">
                    <span className="label-text-alt">Plant species</span>
                </div>
                <SpeciesSelect
                    value={species}
                    species_options={species_options}
                />
            </label>
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text-alt">Pot size</span>
                </div>
                <input
                    name="pot_size"
                    type="number"
                    className="input w-full input-bordered"
                    min="1"
                    max="36"
                    defaultValue={pot_size}
                />
            </label>
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text-alt">Description</span>
                </div>
                <textarea
                    name="description"
                    className="textarea textarea-bordered"
                    defaultValue={description}
                />
            </label>
        </form>
    )
}

export default PlantDetails;
