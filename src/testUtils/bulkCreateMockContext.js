import createMockContext from './createMockContext';

// Takes nested mockContext JSON (simulates backend render_react_app state arg)
// Iterates and creates DOM elements with ID of each key containing contents of
// each key (simulates django json_script filter used in index.html)
const bulkCreateMockContext = (json) => {
    Object.entries(json).forEach(([key, value]) => {
        createMockContext(key, value);
    });
};

export default bulkCreateMockContext;
