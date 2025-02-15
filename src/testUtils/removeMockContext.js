// Removes DOM elements created by src/testUtils/createMockContext.js
// Takes id of element to remove
const removeMockContext = (id) => {
    const element = document.getElementById(id);
    element.remove();
};

export default removeMockContext;
