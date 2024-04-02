import renderer from 'react-test-renderer';
import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { ToastProvider } from 'src/context/ToastContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot', () => {
        // Create mock state objects
        createMockContext('tray', mockContext.tray);
        createMockContext('details', mockContext.details);
        createMockContext('options', mockContext.options);

        // Render App, confirm matches snapshot
        const component = renderer.create(
            <ThemeProvider>
                <ToastProvider>
                    <App />
                </ToastProvider>
            </ThemeProvider>
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();
    });
});
