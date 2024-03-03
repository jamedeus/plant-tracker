import renderer from 'react-test-renderer';
import { DateTime } from 'src/luxonMock';
import App from '../App';

// Simulated django context, parsed into state object
const mockContext = {
    "plants": [
        {
            "name": "Test Plant",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            "species": "Calathea",
            "description": "",
            "pot_size": "4",
            "last_watered": "2024-02-26T02:44:12+00:00",
            "last_fertilized": "2024-02-26T02:44:12+00:00"
        }
    ],
    "trays": [
        {
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
            "name": "Test tray",
            "location": "Middle shelf",
            "plants": 4
        }
    ]
}

describe('App', () => {
    // Setup: Create mock state objects
    beforeEach(() => {
        const mockPlants = document.createElement('div');
        mockPlants.id = 'plants';
        mockPlants.textContent = JSON.stringify(mockContext.plants);
        document.body.appendChild(mockPlants);

        const mockTrays = document.createElement('div');
        mockTrays.id = 'trays';
        mockTrays.textContent = JSON.stringify(mockContext.trays);
        document.body.appendChild(mockTrays);
    });

    it('matches snapshot', () => {
        // Mock system time so relative times ("1 hour ago") don't change
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));

        const component = renderer.create(
            <App />
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();

        // Reset mock
        jest.useRealTimers();
    });
});
