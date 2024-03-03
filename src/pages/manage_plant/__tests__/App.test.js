import renderer from 'react-test-renderer';
import { DateTime } from 'src/luxonMock';
import App from '../App';
import { ToastProvider } from 'src/ToastContext';

// Simulated django context, parsed into state object
const mockContext = {
    "plant": {
        "name": "Test Plant",
        "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
        "species": "Calathea",
        "description": "This is a plant with a long description",
        "pot_size": 4,
        "last_watered": "2024-03-01T05:45:44+00:00",
        "last_fertilized": "2024-03-01T05:45:44+00:00",
        "display_name": "Test Plant",
        "events": {
            "water": [
                "2024-03-01T05:45:44+00:00",
                "2024-02-29T10:20:15+00:00",
            ],
            "fertilize": [
                "2024-03-01T05:45:44+00:00",
                "2024-02-26T02:44:12+00:00",
            ]
        },
        "tray": {
            "name": "Test tray",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
        }
    },
    "trays": [
        {
            "name": "Test tray",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14"
        },
        {
            "name": "Testing",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be61"
        }
    ],
    "species_options": [
        "Parlor Palm",
        "Spider Plant",
        "Calathea"
    ]
}

describe('App', () => {
    // Setup: Create mock state objects
    beforeEach(() => {
        const mockPlant = document.createElement('div');
        mockPlant.id = 'plant';
        mockPlant.textContent = JSON.stringify(mockContext.plant);
        document.body.appendChild(mockPlant);

        const mockTrays = document.createElement('div');
        mockTrays.id = 'trays';
        mockTrays.textContent = JSON.stringify(mockContext.trays);
        document.body.appendChild(mockTrays);

        const mockSpeciesOptions = document.createElement('div');
        mockSpeciesOptions.id = 'species_options';
        mockSpeciesOptions.textContent = JSON.stringify(mockContext.species_options);
        document.body.appendChild(mockSpeciesOptions);
    });

    it('matches snapshot', () => {
        // Mock system time so relative times ("1 hour ago") don't change
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));

        const component = renderer.create(
            <ToastProvider>
                <App />
            </ToastProvider>
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();

        // Reset mock
        jest.useRealTimers();
    });
});
