import renderer from 'react-test-renderer';
import { DateTime } from 'src/testUtils/luxonMock';
import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { ToastProvider } from 'src/ToastContext';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot', () => {
        // Mock system time so relative times ("1 hour ago") don't change
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));

        // Create mock state objects
        createMockContext('plant', mockContext.plant);
        createMockContext('trays', mockContext.trays);
        createMockContext('species_options', mockContext.species_options);

        // Render App, confirm matches snapshot
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
