import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state objects
        createMockContext('new_id', mockContext.new_id);
        createMockContext('species_options', mockContext.species_options);
    });

    beforeEach(() => {
        // Render app + create userEvent instance to use in tests
        app = render(
            <ThemeProvider>
                <ErrorModalProvider>
                    <App />
                </ErrorModalProvider>
            </ThemeProvider>
        );
        user = userEvent.setup();
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
        const buttons = app.container.querySelector('.tab-group');
        await user.click(within(buttons).getByText('Group'));

        // Confirm group form is visible
        expect(app.getByText('Group name').nodeName).toBe('SPAN');
        expect(app.getByText('Group location').nodeName).toBe('SPAN');
        // Confirm plant form is not visible
        expect(app.queryByText('Plant name')).toBeNull();
        expect(app.queryByText('Plant species')).toBeNull();
        expect(app.queryByText('Pot size')).toBeNull();

        // Click plant button
        await user.click(within(buttons).getByText('Plant'));

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
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            redirected: true,
            url: '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        }));

        // Fill in form fields
        await userEvent.type(app.getByLabelText('Plant name'), 'Test plant');
        await userEvent.type(app.getByLabelText('Plant species'), 'Fittonia');
        await userEvent.type(app.getByLabelText('Description'), 'Clay pot');
        await userEvent.type(app.getByLabelText('Pot size'), '6');

        // Click Save button
        await userEvent.click(app.getByText('Save'));

        // Confirm correct data posted to /register_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/register_plant', {
            method: 'POST',
            body: JSON.stringify({
                "name": "Test plant",
                "species": "Fittonia",
                "pot_size": "6",
                "description": "Clay pot",
                "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            }),
            headers: postHeaders
        });
    });

    it('sends the correct payload when group form is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            redirected: true,
            url: '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        }));

        // Click Group button
        await user.click(app.getByText('Group'));

        // Fill in form fields
        await userEvent.type(app.getByLabelText('Group name'), 'Test group');
        await userEvent.type(app.getByLabelText('Group location'), 'Middle shelf');
        await userEvent.type(app.getByLabelText('Description'), 'Microgreens');

        // Click Save button
        await userEvent.click(app.getByText('Save'));

        // Confirm correct data posted to /register_group endpoint
        expect(global.fetch).toHaveBeenCalledWith('/register_group', {
            method: 'POST',
            body: JSON.stringify({
                "name": "Test group",
                "location": "Middle shelf",
                "description": "Microgreens",
                "uuid": "0640ec3b-1bed-4b15-a078-d6e7ec66be12"
            }),
            headers: postHeaders
        });
    });

    it('shows error modal if registration fails', async () => {
        // Mock fetch function to return error response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            redirected: false,
            json: () => Promise.resolve({
                "error": "Failed to register plant"
            })
        }));

        // Confirm error text is not in document
        expect(app.queryByText('Failed to register plant')).toBeNull();

        // Click Save button, confirm error modal appears
        await userEvent.click(app.getByText('Save'));
        expect(app.getByText('Failed to register plant')).toBeInTheDocument();
    });

    it('redirects to overview when dropdown option is clicked', async () => {
        // Click overview dropdown option, confirm redirected
        await user.click(app.getByText('Overview'));
        expect(window.location.href).toBe('/');
    });

    it('shows unexpected API response in error modal', async () => {
        // Mock fetch function to return unexpected response (not error or redirect)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            redirected: false,
            json: () => Promise.resolve({
                "error": "Unexpected, should return redirect or error"
            })
        }));

        // Confirm error text is not in document
        expect(app.queryByText(/Unexpected, should return redirect or error/)).toBeNull();

        // Click Save button, confirm error modal appears
        await userEvent.click(app.getByText('Save'));
        expect(app.getByText(/Unexpected, should return redirect or error/)).toBeInTheDocument();
    });
});
