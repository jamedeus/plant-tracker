import mockPlantSpeciesOptionsResponse from 'src/testUtils/mockPlantSpeciesOptionsResponse';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockFetchResponse from 'src/testUtils/mockFetchResponse';
import { postHeaders } from 'src/testUtils/headers';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import App from '../App';
import { mockContext } from './mockContext';

// Mock useRevalidator to return a mock (no react-router provider in tests)
const mockRevalidate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useRevalidator: () => ({ revalidate: mockRevalidate })
}));

// Mock the global navigate function used by sendPostRequest
jest.mock('src/navigate', () => ({
    navigate: jest.fn(),
    setNavigate: jest.fn(),
}));
import { navigate as globalMockNavigate } from 'src/navigate';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    beforeEach(async () => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Mock /get_plant_species_options response (requested when page loads)
        mockPlantSpeciesOptionsResponse();

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');
        globalMockNavigate.mockReset();
        mockRevalidate.mockReset();

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <>
                <App initialState={mockContext} />
                <Toast />
                <ErrorModal />
            </>
        );

        // Wait for species options to be fetched
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('shows the correct form when buttons are clicked', async () => {
        // Confirm plant form is visible
        expect(app.getByText('Plant name').nodeName).toBe('SPAN');
        expect(app.getByText('Plant species').nodeName).toBe('SPAN');
        expect(app.getByText('Pot size').nodeName).toBe('SPAN');
        // Confirm group form is not visible
        expect(app.queryByText('Group name')).toBeNull();
        expect(app.queryByText('Group location')).toBeNull();

        // Click group button
        await user.click(app.getByRole('tab', {name: 'Group'}));

        // Confirm group form is visible
        expect(app.getByText('Group name').nodeName).toBe('SPAN');
        expect(app.getByText('Group location').nodeName).toBe('SPAN');
        // Confirm plant form is not visible
        expect(app.queryByText('Plant name')).toBeNull();
        expect(app.queryByText('Plant species')).toBeNull();
        expect(app.queryByText('Pot size')).toBeNull();

        // Click plant button
        await user.click(app.getByRole('tab', {name: 'Plant'}));

        // Confirm plant form is visible
        expect(app.getByText('Plant name').nodeName).toBe('SPAN');
        expect(app.getByText('Plant species').nodeName).toBe('SPAN');
        expect(app.getByText('Pot size').nodeName).toBe('SPAN');
        // Confirm group form is not visible
        expect(app.queryByText('Group name')).toBeNull();
        expect(app.queryByText('Group location')).toBeNull();
    });

    it('sends the correct payload when plant form is submitted', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            success: 'plant registered',
            name: 'Test plant',
            uuid: '0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        });

        // Fill in form fields
        await user.type(app.getByRole('textbox', {name: 'Plant name'}), 'Test plant');
        await user.type(app.getByRole('combobox', {name: 'Plant species'}), 'Fittonia');
        await user.type(app.getByRole('textbox', {name: 'Description'}), 'Clay pot');
        await user.type(app.getByLabelText('Pot size'), '6');

        // Click Save button
        await user.click(app.getByText('Save'));

        // Confirm correct data posted to /register_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/register_plant', {
            method: 'POST',
            body: JSON.stringify({
                uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                name: "Test plant",
                species: "Fittonia",
                pot_size: "6",
                description: "Clay pot",
            }),
            headers: postHeaders
        });
    });

    it('sends the correct payload when group form is submitted', async () => {
        // Mock fetch function to return expected response
        mockFetchResponse({
            success: 'group registered',
            name: 'Test group',
            uuid: '0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        });

        // Click Group button
        await user.click(app.getByText('Group'));

        // Fill in form fields
        await user.type(app.getByRole('textbox', {name: 'Group name'}), 'Test group');
        await user.type(app.getByRole('textbox', {name: 'Group location'}), 'Middle shelf');
        await user.type(app.getByRole('textbox', {name: 'Description'}), 'Microgreens');

        // Click Save button
        await user.click(app.getByText('Save'));

        // Confirm correct data posted to /register_group endpoint
        expect(global.fetch).toHaveBeenCalledWith('/register_group', {
            method: 'POST',
            body: JSON.stringify({
                uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                name: "Test group",
                location: "Middle shelf",
                description: "Microgreens",
            }),
            headers: postHeaders
        });
    });

    it('shows error modal if registration fails', async () => {
        // Mock fetch function to return error response
        mockFetchResponse({error: "Failed to register plant"}, 400);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Click Save button, confirm error modal appears
        await user.click(app.getByText('Save'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'Failed to register plant'
        );
    });

    it('disables the save button when plant fields exceed max length', async () => {
        // Confirm save button is enabled
        expect(app.getByRole('button', {name: 'Save'})).not.toBeDisabled();

        // Get fields with length limits
        const nameField = app.getByRole('textbox', {name: 'Plant name'});
        const speciesField = app.getByRole('combobox', {name: 'Plant species'});
        const descriptionField = app.getByRole('textbox', {name: 'Description'});

        // Type >50 characters in Plant name field, confirm save button is disabled
        await user.type(nameField, '.'.repeat(51));
        expect(app.getByRole('button', {name: 'Save'})).toBeDisabled();
        await user.clear(nameField);

        // Type >50 characters in species field, confirm save button is disabled
        await user.type(speciesField, '.'.repeat(51));
        expect(app.getByRole('button', {name: 'Save'})).toBeDisabled();
        await user.clear(speciesField);

        // Type >500 characters in description field, confirm save button is disabled
        await user.type(descriptionField, '.'.repeat(501));
        expect(app.getByRole('button', {name: 'Save'})).toBeDisabled();
    });

    it('disables the save button when group fields exceed max length', async () => {
        // Click Group button
        await user.click(app.getByText('Group'));

        // Confirm save button is enabled
        expect(app.getByRole('button', {name: 'Save'})).not.toBeDisabled();

        // Get fields with length limits
        const nameField = app.getByRole('textbox', {name: 'Group name'});
        const locationField = app.getByRole('textbox', {name: 'Group location'});
        const descriptionField = app.getByRole('textbox', {name: 'Description'});

        // Type >50 characters in Group name field, confirm save button is disabled
        await user.type(nameField, '.'.repeat(51));
        expect(app.getByRole('button', {name: 'Save'})).toBeDisabled();
        await user.clear(nameField);

        // Type >50 characters in location field, confirm save button is disabled
        await user.type(locationField, '.'.repeat(51));
        expect(app.getByRole('button', {name: 'Save'})).toBeDisabled();
        await user.clear(locationField);

        // Type >500 characters in description field, confirm save button is disabled
        await user.type(descriptionField, '.'.repeat(501));
        expect(app.getByRole('button', {name: 'Save'})).toBeDisabled();
    });

    it('re-enables the save button when form is changed', async () => {
        // Confirm save button is enabled
        expect(app.getByRole('button', {name: 'Save'})).not.toBeDisabled();

        // Type >50 characters in Plant name field, confirm save button is disabled
        await user.type(app.getByRole('textbox', {name: 'Plant name'}), '.'.repeat(51));
        expect(app.getByRole('button', {name: 'Save'})).toBeDisabled();

        // Switch to Group form, confirm save button is enabled
        await user.click(app.getByText('Group'));
        expect(app.getByRole('button', {name: 'Save'})).not.toBeDisabled();

        // Type >50 characters in Group name field, confirm save button is disabled
        await user.type(app.getByRole('textbox', {name: 'Group name'}), '.'.repeat(51));
        expect(app.getByRole('button', {name: 'Save'})).toBeDisabled();

        // Switch back to Plant form, confirm save button is enabled
        await user.click(app.getByText('Plant'));
        expect(app.getByRole('button', {name: 'Save'})).not.toBeDisabled();
    });

    // Note: this response can only be received if SINGLE_USER_MODE is disabled
    it('redirects to login page if user is not signed in', async () => {
        // Mock fetch function to simulate user with an expired session
        mockFetchResponse({error: "authentication required"}, 401);

        // Fill in form fields
        await user.type(app.getByRole('textbox', {name: 'Plant name'}), 'Test plant');
        await user.type(app.getByRole('combobox', {name: 'Plant species'}), 'Fittonia');
        await user.type(app.getByRole('textbox', {name: 'Description'}), 'Clay pot');
        await user.type(app.getByLabelText('Pot size'), '6');

        // Click Save button
        await user.click(app.getByText('Save'));

        // Confirm redirected
        expect(globalMockNavigate).toHaveBeenCalledWith('/accounts/login/');
    });
});
