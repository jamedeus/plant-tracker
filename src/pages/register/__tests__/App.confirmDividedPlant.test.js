import createMockContext from 'src/testUtils/createMockContext';
import mockPlantSpeciesOptionsResponse from 'src/testUtils/mockPlantSpeciesOptionsResponse';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import { postHeaders } from 'src/testUtils/headers';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext, mockDividingFrom } from './mockContext';

describe('Register page while plant division in progress', () => {
    let app, user;

    beforeAll(() => {
        // Create mock state object
        createMockContext('user_accounts_enabled', true);
    });

    beforeEach(() => {
        // Mock /get_plant_species_options response (requested when plant form loads)
        mockPlantSpeciesOptionsResponse();

        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup();
        app = render(
            <PageWrapper>
                <App initialState={{ ...mockContext, dividing_from: mockDividingFrom }} />
            </PageWrapper>
        );
    });

    it('shows plant form if user clicks green button', async () => {
        // Confirm plant form is NOT visible
        expect(app.queryByText('Plant name')).toBeNull();
        expect(app.queryByText('Plant species')).toBeNull();
        expect(app.queryByText('Pot size')).toBeNull();
        // Confirm group form is not visible
        expect(app.queryByText('Group name')).toBeNull();
        expect(app.queryByText('Group location')).toBeNull();
        // Confirm tabs are not visible
        expect(app.queryByRole('tab')).toBeNull();

        // Click green confirm button
        await user.click(app.getByTitle('Plant was divided'));

        // Confirm plant form appeared
        expect(app.getByText('Plant name').nodeName).toBe('SPAN');
        expect(app.getByText('Plant species').nodeName).toBe('SPAN');
        expect(app.getByText('Pot size').nodeName).toBe('SPAN');
        // Confirm group form is not visible
        expect(app.queryByText('Group name')).toBeNull();
        expect(app.queryByText('Group location')).toBeNull();
        // Confirm tabs are still not visible (can't register group if divided)
        expect(app.queryByRole('tab')).toBeNull();
    });

    it('pre-fills plant form fields if user confirms dividing plant', async () => {
        // Click green confirm button (confirm dividing plant)
        await user.click(app.getByTitle('Plant was divided'));

        // Confirm all fields are pre-filled with values from parent plant
        expect(app.getByRole('textbox', {name: 'Plant name'}).value).toBe('Test Plant prop');
        expect(app.getByRole('combobox', {name: 'Plant species'}).value).toBe('Calathea');
        expect(app.getByRole('textbox', {name: 'Pot size'}).value).toBe('4');
        expect(app.getByRole('textbox', {name: 'Description'}).value).toBe(
            'Divided from Test Plant on March 1, 2024'
        );
    });

    it('shows both forms if user clicks red button', async () => {
        // Confirm plant form is NOT visible
        expect(app.queryByText('Plant name')).toBeNull();
        expect(app.queryByText('Plant species')).toBeNull();
        expect(app.queryByText('Pot size')).toBeNull();
        // Confirm group form is not visible
        expect(app.queryByText('Group name')).toBeNull();
        expect(app.queryByText('Group location')).toBeNull();
        // Confirm tabs are not visible
        expect(app.queryByRole('tab')).toBeNull();

        // Click red reject button (registration unrelated to in-progress division)
        await user.click(app.getByTitle('Plant was NOT divided'));

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

    it('sends payload with database keys when form is submitted after confirming division', async () => {
        // Click green confirm button
        await user.click(app.getByTitle('Plant was divided'));

        // Change name, leave other fields at default
        await user.clear(app.getByRole('textbox', {name: 'Plant name'}));
        await user.type(app.getByRole('textbox', {name: 'Plant name'}), 'Baby test plant');

        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                success: 'plant registered'
            })
        }));

        // Click Save button
        await user.click(app.getByText('Save'));

        // Confirm correct data posted to /register_plant endpoint
        // Payload should include parent plant + division event keys (from context)
        expect(global.fetch).toHaveBeenCalledWith('/register_plant', {
            method: 'POST',
            body: JSON.stringify({
                uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                name: "Baby test plant",
                species: "Calathea",
                pot_size: "4",
                description: 'Divided from Test Plant on March 1, 2024',
                divided_from_id: "234",
                divided_from_event_id: "893",
            }),
            headers: postHeaders
        });
    });

    it('sends payload without database keys when form is submitted after rejecting division', async () => {
        // Click red reject button (registration unrelated to in-progress division)
        await user.click(app.getByTitle('Plant was NOT divided'));

        // Fill in form fields
        await user.type(app.getByRole('textbox', {name: 'Plant name'}), 'Test plant');
        await user.type(app.getByRole('combobox', {name: 'Plant species'}), 'Fittonia');
        await user.type(app.getByRole('textbox', {name: 'Description'}), 'Clay pot');
        await user.type(app.getByLabelText('Pot size'), '6');

        // Mock fetch function to return expected response
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                success: 'plant registered'
            })
        }));

        // Click Save button
        await user.click(app.getByText('Save'));

        // Confirm correct data posted to /register_plant endpoint
        // Payload should NOT include parent plant + division event keys
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
});
