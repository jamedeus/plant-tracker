import AddPlantsModal from '../AddPlantsModal';
import { mockContext, mockPlantOptions } from './mockContext';
import { ReduxProvider } from '../store';

const TestComponent = () => {
    return (
        <ReduxProvider initialState={mockContext}>
            <AddPlantsModal />
        </ReduxProvider>
    );
};

describe('AddPlantsModal', () => {
    beforeEach(() => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });
    });

    // Clean up pending timers after each test
    afterEach(() => {
        act(() => jest.runAllTimers());
        jest.useRealTimers();
    });

    it('renders a card for each plant option in /get_plant_options response', async () => {
        // Mock fetch to return options (requested when modal opened)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ options: mockPlantOptions })
        }));

        // Render modal
        const component = render(<TestComponent />);

        // Confirm options requested
        await act(async () => await jest.advanceTimersByTimeAsync(0));
        expect(global.fetch).toHaveBeenCalledWith('/get_plant_options');

        // Confirm a card was rendered for each plant in options (all plants in
        // database) that isn't already in details (all plants in group)
        await waitFor(() => {
            const titles = component.container.querySelectorAll('.card-title');
            expect(titles.length).toBe(2);
            expect(titles[0].innerHTML).toBe("Another test plant");
            expect(titles[1].innerHTML).toBe("Third test plant");
        });
    });

    it('renders "No plants" when /get_plant_options response is empty', async () => {
        // Mock fetch to return empty options (requested when modal opened)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ options: {} })
        }));

        // Render modal
        const component = render(<TestComponent />);

        // Confirm no cards, confirm expected text
        await waitFor(() => {
            const titles = component.container.querySelectorAll('.card-title');
            expect(titles.length).toBe(0);
            expect(component.queryByText('No plants')).not.toBeNull();
        });
    });

    it('renders "No plants" if error occurs in /get_plant_options request', async () => {
        // Mock fetch to simulate error when group options requested
        global.fetch = jest.fn(() => Promise.resolve({ ok: false }));

        // Render modal
        const component = render(<TestComponent />);

        // Confirm no cards, confirm expected text
        await waitFor(() => {
            const titles = component.container.querySelectorAll('.card-title');
            expect(titles.length).toBe(0);
            expect(component.queryByText('No plants')).not.toBeNull();
        });
    });

    it('shows spinner until options load', async () => {
        // Mock fetch to return options (requested when modal opened)
        // Add delay so loading spinner will render (simulate real request)
        global.fetch = jest.fn(() => new Promise(resolve =>
            setTimeout(() => {
                resolve({
                    ok: true,
                    json: () => Promise.resolve({ options: mockPlantOptions })
                });
            }, 5)
        ));

        // Render modal
        const component = render(<TestComponent />);

        // Confirm loading spinner rendered, contents did not
        await waitFor(() => {
            expect(document.querySelector('.loading')).not.toBeNull();
            expect(component.queryByText('Another test plant')).toBeNull();
        });

        // Fast forward until response received
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5);
        });

        // Confirm spinner disappeared, contents appeared
        await waitFor(() => {
            expect(document.querySelector('.loading')).toBeNull();
            expect(component.getByText('Another test plant')).not.toBeNull();
        });
    });
});
