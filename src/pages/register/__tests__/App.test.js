import { render, within } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import createMockContext from 'src/testUtils/createMockContext';
import { postHeaders } from 'src/testUtils/headers';
import { ThemeProvider } from 'src/context/ThemeContext';
import App from '../App';
import { mockContext } from './mockContext';
import '@testing-library/jest-dom';

describe('App', () => {
    let app, user;

    beforeEach(() => {
        // Create mock state objects
        createMockContext('new_id', mockContext.new_id);
        createMockContext('species_options', mockContext.species_options);

        // Render app + create userEvent instance to use in tests
        app = render(
            <ThemeProvider>
                <App />
            </ThemeProvider>
        );
        user = userEvent.setup();

        // Reset all mocks to isolate tests
        jest.resetAllMocks();
    });

    it('shows the correct form when buttons are clicked', async () => {
        // Confirm plant form is visible
        expect(app.getByText('Plant name').nodeName).toBe('SPAN');
        expect(app.getByText('Plant species').nodeName).toBe('SPAN');
        expect(app.getByText('Pot size').nodeName).toBe('SPAN');
        // Confirm tray form is not visible
        expect(app.queryByText('Tray name')).toBeNull();
        expect(app.queryByText('Tray location')).toBeNull();

        // Click tray button
        const buttons = app.container.querySelector('.tab-group');
        await user.click(within(buttons).getByText('Tray'));

        // Confirm tray form is visible
        expect(app.getByText('Tray name').nodeName).toBe('SPAN');
        expect(app.getByText('Tray location').nodeName).toBe('SPAN');
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
        // Confirm tray form is not visible
        expect(app.queryByText('Tray name')).toBeNull();
        expect(app.queryByText('Tray location')).toBeNull();
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

    it('sends the correct payload when tray form is submitted', async () => {
        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            redirected: true,
            url: '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        }));

        // Click Tray button
        await user.click(app.getByText('Tray'));

        // Fill in form fields
        await userEvent.type(app.getByLabelText('Tray name'), 'Test tray');
        await userEvent.type(app.getByLabelText('Tray location'), 'Middle shelf');
        await userEvent.type(app.getByLabelText('Description'), 'Microgreens');

        // Click Save button
        await userEvent.click(app.getByText('Save'));

        // Confirm correct data posted to /register_tray endpoint
        expect(global.fetch).toHaveBeenCalledWith('/register_tray', {
            method: 'POST',
            body: JSON.stringify({
                "name": "Test tray",
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
        Object.defineProperty(window, 'location', {
            value: {
                assign: jest.fn(),
            },
        });

        // Click overview dropdown option, confirm redirected
        await user.click(app.getByText('Overview'));
        expect(window.location.href).toBe('/');
        jest.resetAllMocks();
    });
});
