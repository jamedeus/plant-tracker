import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot', () => {
        // Create mock state objects
        createMockContext('type', 'group');
        createMockContext('instance', mockContext.group);
        createMockContext('new_uuid', mockContext.new_uuid);

        // Render App, confirm matches snapshot
        const component = render(
            <ThemeProvider>
                <ErrorModalProvider>
                    <App />
                </ErrorModalProvider>
            </ThemeProvider>
        );
        expect(component).toMatchSnapshot();
    });
});
