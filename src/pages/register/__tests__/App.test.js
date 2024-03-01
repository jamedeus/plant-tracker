import renderer from 'react-test-renderer';
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
        const mockNewID = document.createElement('div');
        mockNewID.id = 'new_id';
        mockNewID.textContent = JSON.stringify(mockContext.new_id);
        document.body.appendChild(mockNewID);

        const mockSpeciesOptions = document.createElement('div');
        mockSpeciesOptions.id = 'species_options';
        mockSpeciesOptions.textContent = JSON.stringify(mockContext.species_options);
        document.body.appendChild(mockSpeciesOptions);
    });

    it('matches snapshot', () => {
        const component = renderer.create(
            <App />
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();
    });
});
