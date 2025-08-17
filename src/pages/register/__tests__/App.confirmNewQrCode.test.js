import createMockContext from 'src/testUtils/createMockContext';
import mockPlantSpeciesOptionsResponse from 'src/testUtils/mockPlantSpeciesOptionsResponse';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import { postHeaders } from 'src/testUtils/headers';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext, mockChangingPlantQrCode } from './mockContext';

// Mock router.navigate to check sendPostRequest redirect (without rendering whole SPA)
jest.mock('src/spa/routes', () => {
    return {
        __esModule: true,
        default: { navigate: jest.fn().mockResolvedValue(true) },
    };
});
import routerMock from 'src/spa/routes';

describe('Register page while changing QR code in progress', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state object
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <App initialState={{ ...mockContext, ...mockChangingPlantQrCode }} />
            </PageWrapper>
        );
    });

    it('shows both forms if user clicks red button', async () => {
        // Mock /get_plant_species_options response (requested when plant form loads)
        mockPlantSpeciesOptionsResponse();

        // Confirm plant form is NOT visible
        expect(app.queryByText('Plant name')).toBeNull();
        expect(app.queryByText('Plant species')).toBeNull();
        expect(app.queryByText('Pot size')).toBeNull();
        // Confirm group form is not visible
        expect(app.queryByText('Group name')).toBeNull();
        expect(app.queryByText('Group location')).toBeNull();
        // Confirm tabs are not visible
        expect(app.queryByRole('tab')).toBeNull();

        // Click red reject button (registering new plant, not changing QR code)
        await user.click(app.getByTitle("Don't change QR code"));

        // Confirm plant form appeared
        expect(app.getByText('Plant name').nodeName).toBe('SPAN');
        expect(app.getByText('Plant species').nodeName).toBe('SPAN');
        expect(app.getByText('Pot size').nodeName).toBe('SPAN');
        // Confirm group form is not visible
        expect(app.queryByText('Group name')).toBeNull();
        expect(app.queryByText('Group location')).toBeNull();

        // Confirm tabs appeared (can register plant or group)
        expect(app.queryAllByRole('tab')).not.toBeNull();

        // Click group button
        await user.click(app.getByRole('tab', {name: 'Group'}));

        // Confirm group form is visible
        expect(app.getByText('Group name').nodeName).toBe('SPAN');
        expect(app.getByText('Group location').nodeName).toBe('SPAN');
        // Confirm plant form is not visible
        expect(app.queryByText('Plant name')).toBeNull();
        expect(app.queryByText('Plant species')).toBeNull();
        expect(app.queryByText('Pot size')).toBeNull();
    });

    it('sends correct payload when confirm button is clicked', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                uuid: '07919189-514d-4ec1-a967-8af553dfa7e8'
            })
        }));

        // Click confirm button
        await user.click(app.getByTitle('Change QR code'));

        // Confirm correct data posted to /change_uuid endpoint
        expect(global.fetch).toHaveBeenCalledWith('/change_uuid', {
            method: 'POST',
            body: JSON.stringify({
                uuid: '0640ec3b-1bed-4b15-a078-d6e7ec66be12',
                new_id: '07919189-514d-4ec1-a967-8af553dfa7e8'
            }),
            headers: postHeaders
        });

        // Confirm window.location.reload was called
        expect(window.location.reload).toHaveBeenCalled();
    });

    it('shows error modal if error received after confirm button clicked', async() => {
        // Mock fetch function to return arbitrary error
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
                error: "failed to change QR code"
            })
        }));

        // Confirm arbitrary error does not appear on page
        expect(app.queryByText(/failed to change QR code/)).toBeNull();

        // Click confirm button
        await user.click(app.getByTitle('Change QR code'));

        // Confirm modal appeared with arbitrary error text
        expect(app.queryByText(/failed to change QR code/)).not.toBeNull();
    });

    // Note: this response can only be received if SINGLE_USER_MODE is disabled
    it('redirects to login page when confirm button clicked if user is not signed in', async () => {
        // Mock fetch function to simulate user with an expired session
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({
                error: "authentication required"
            })
        }));

        // Click confirm button
        await user.click(app.getByTitle('Change QR code'));

        // Confirm redirected
        expect(routerMock.navigate).toHaveBeenCalledWith('/accounts/login/');
    });
});
