import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CollapseCol from 'src/components/CollapseCol';
import EditableNodeList from 'src/components/EditableNodeList';

// Renders CollapseCol with EditableNodeList and input to filter contents
//
// Takes title string, contents (array of objects), cardComponent (functional
// component with args matching keys in contents objects), and pre-rendered
// EditableNodeList element with no children (will be replaced).
//
// Contents objects must have uuid (react key) and name (used to filter) keys
// EditableNodeList must have state params set in parent scope
const FilterColumn = ({title, contents, cardComponent, editableList}) => {
    const [query, setQuery] = useState('');
    const [current, setCurrent] = useState(contents);

    // Filter contents to items
    useEffect(() => {
        // Filter contents to items that contain query (case insensitive)
        if (query) {
            setCurrent(contents.filter(
                item => item.name.toLowerCase().includes(query.toLowerCase()))
            );
        // Reset contents when query cleared
        } else {
            setCurrent(contents);
        }
    }, [query])

    return (
        <CollapseCol title={`${title} (${Object.keys(current).length})`}>
            <div className="px-4 mb-4">
                <input
                    type="text"
                    className="input input-bordered w-full text-center"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="filter"
                />
            </div>
            {React.cloneElement(
                editableList,
                {},
                current.map((item) => {
                    // Render cardComponent by expanding params of each item
                    // Must have UUID param to use as react key
                    return React.createElement(
                        cardComponent,
                        {...item, key: item.uuid}
                    );
                })
            )}
        </CollapseCol>
    )
};

FilterColumn.propTypes = {
    title: PropTypes.string,
    contents: PropTypes.array,
    cardComponent: PropTypes.func,
    editableList: PropTypes.node
};

export default FilterColumn;
