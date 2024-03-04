import renderer from 'react-test-renderer';
import { DateTime } from 'src/testUtils/luxonMock';
import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot', () => {
        // Mock system time so relative times ("1 hour ago") don't change
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));

        // Create mock state objects
        createMockContext('plants', mockContext.plants);
        createMockContext('trays', mockContext.trays);

        // Render App, confirm matches snapshot
        const component = renderer.create(
            <App />
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();

        // Reset mock
        jest.useRealTimers();
    });
});
