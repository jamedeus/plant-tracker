import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot when changing plant QR code', () => {
        // Create mock state objects
        createMockContext('type', 'plant');
        createMockContext('instance', mockContext.plant);
        createMockContext('new_uuid', mockContext.new_uuid);
        createMockContext('user_accounts_enabled', true);
        createMockContext('preview', mockContext.preview);

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when changing group QR code', () => {
        // Create mock state objects
        createMockContext('type', 'group');
        createMockContext('instance', mockContext.group);
        createMockContext('new_uuid', mockContext.new_uuid);
        createMockContext('user_accounts_enabled', true);

        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });
});
