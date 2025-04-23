import React, { Fragment, useState } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { parseDomContext } from 'src/util';
import { Combobox, Transition } from '@headlessui/react';

const SpeciesSelect = ({ value }) => {
    // Load existing species options from django template context
    const speciesOptions = parseDomContext("species_options");

    // State for current input value
    const [query, setQuery] = useState('');

    // State for selected option (start with default value)
    const [selected, setSelected] = useState(value);

    const filteredOptions =
        query === ''
            ? speciesOptions
            : speciesOptions.filter((option) => {
                return option.toLowerCase().includes(query.toLowerCase());
            });

    const Option = ({ value, text }) => {
        return (
            <Combobox.Option
                value={value}
                className={({ active }) => clsx(
                    'combobox-option',
                    active && 'bg-teal-600'
                )}
            >
                {text}
            </Combobox.Option>
        );
    };

    Option.propTypes = {
        value: PropTypes.string.isRequired,
        text: PropTypes.string.isRequired
    };

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
                    {/* Add option if current input not in speciesOptions */}
                    {query.length > 0 && !speciesOptions.includes(query) && (
                        <Option value={query} text={`Create "${query}"`} />
                    )}
                    {/* Add option for each string in filteredOptions */}
                    {filteredOptions.map((option) => (
                        <Option key={option} value={option} text={option} />
                    ))}
                </Combobox.Options>
            </Transition>
        </Combobox>
    );
};

SpeciesSelect.propTypes = {
    value: PropTypes.string
};


const PlantDetailsForm = ({ formRef, name, species, pot_size, description }) => {
    return (
        <form id="plantDetails" ref={formRef} className="flex flex-col gap-4">
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text">Plant name</span>
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
                    <span className="label-text">Plant species</span>
                </div>
                <SpeciesSelect value={species} />
            </label>
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text">Pot size</span>
                </div>
                <input
                    name="pot_size"
                    type="text"
                    inputMode="numeric"
                    className="input w-full input-bordered"
                    min="1"
                    max="36"
                    defaultValue={pot_size}
                    onInput={(e) => {
                        e.target.value = e.target.value.replace(/\D+/g, '');
                    }}
                />
            </label>
            <label className="form-control w-full">
                <div className="label">
                    <span className="label-text">Description</span>
                </div>
                <textarea
                    name="description"
                    className="textarea textarea-bordered"
                    defaultValue={description}
                />
            </label>
        </form>
    );
};

PlantDetailsForm.propTypes = {
    formRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    name: PropTypes.string,
    species: PropTypes.string,
    pot_size: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number
    ]),
    description: PropTypes.string
};

export default PlantDetailsForm;
