import renderer from 'react-test-renderer';
import { DateTime } from 'src/testUtils/luxonMock';
import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { ToastProvider } from 'src/ToastContext';

// Simulated django context, parsed into state object
const mockContext = {
    "tray": {
        "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
        "name": "Test tray",
        "display_name": "Test tray",
        "location": "Middle shelf",
        "description": null
    },
    "details": [
        {
            "name": "Test Plant",
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            "species": "Calathea",
            "description": "This is a plant with a long description with",
            "pot_size": 4,
            "last_watered": "2024-03-01T05:45:44+00:00",
            "last_fertilized": "2024-03-01T05:45:44+00:00"
        },
        {
            "name": "Unnamed Spider Plant",
            "uuid": "19f65fa0-1c75-4cba-b590-0c9b5b315fcc",
            "species": "Spider Plant",
            "description": null,
            "pot_size": 2,
            "last_watered": "2024-03-01T05:45:44+00:00",
            "last_fertilized": "2024-03-01T05:45:44+00:00"
        },
    ],
    "options": [
        {
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
            "name": "Test Plant"
        },
        {
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be16",
            "name": "Another test plant"
        },
        {
            "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be69",
            "name": "Third test plant"
        },
        {
            "uuid": "19f65fa0-1c75-4cba-b590-0c9b5b315fcc",
            "name": "Unnamed Spider Plant"
        }
    ]
}

describe('App', () => {
    // Mock long-supported features that jsdom somehow hasn't implemented yet
    beforeAll(() => {
        HTMLDialogElement.prototype.show = jest.fn();
        HTMLDialogElement.prototype.showModal = jest.fn();
        HTMLDialogElement.prototype.close = jest.fn();
    });

    // Setup: Create mock state objects
    beforeEach(() => {
        createMockContext('tray', mockContext.tray);
        createMockContext('details', mockContext.details);
        createMockContext('options', mockContext.options);
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
