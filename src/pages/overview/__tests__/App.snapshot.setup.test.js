import renderer from 'react-test-renderer';
import createMockContext from 'src/testUtils/createMockContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import App from '../App';

describe('App', () => {
    it('matches snapshot when no models exist (setup)', () => {
        // Mock system time so relative times ("1 hour ago") don't change
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-03-01T12:00:00Z'));

        // Create mock state objects
        createMockContext('plants', []);
        createMockContext('trays', []);

        // Render App, confirm matches snapshot
        const component = renderer.create(
            <ThemeProvider>
                <ErrorModalProvider>
                    <App />
                </ErrorModalProvider>
            </ThemeProvider>
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();

        // Reset mock
        jest.useRealTimers();
    });
});
