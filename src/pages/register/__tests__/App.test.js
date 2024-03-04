import renderer from 'react-test-renderer';
import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';

// Simulated django context, parsed into state object
const mockContext = {
    "new_id": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
    "species_options": [
        "Parlor Palm",
        "Spider Plant",
        "Calathea"
    ]
}

describe('App', () => {
    // Setup: Create mock state objects
    beforeEach(() => {
        createMockContext('new_id', mockContext.new_id);
        createMockContext('species_options', mockContext.species_options);
    });

    it('matches snapshot', () => {
        const component = renderer.create(
            <App />
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();
    });
});
