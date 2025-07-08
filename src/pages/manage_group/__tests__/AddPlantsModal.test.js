import AddPlantsModal, { openAddPlantsModal } from '../AddPlantsModal';
import { mockPlantOptions } from './mockContext';

describe('AddPlantsModal', () => {
    it('renders a card for each plant option', async () => {
        // Mock fetch to return options (requested when modal opened)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ options: mockPlantOptions })
        }));

        // Render modal
        const component = render(
            <AddPlantsModal addPlants={jest.fn()} />
        );

        // Confirm a card was rendered for each plant in options (all plants in
        // database) that isn't already in details (all plants in group)
        openAddPlantsModal();
        await waitFor(() => {
            const titles = component.container.querySelectorAll('.card-title');
            expect(titles.length).toBe(2);
            expect(titles[0].innerHTML).toBe("Another test plant");
            expect(titles[1].innerHTML).toBe("Third test plant");
        });
    });

    it('renders expected text when no plant options', async () => {
        // Mock fetch to return empty options (requested when modal opened)
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ options: {} })
        }));

        // Render modal with no plant options
        const component = render(
            <AddPlantsModal
                options={[]}
                addPlants={jest.fn()}
            />
        );

        // Confirm no cards, confirm expected text
        openAddPlantsModal();
        await waitFor(() => {
            const titles = component.container.querySelectorAll('.card-title');
            expect(titles.length).toBe(0);
            expect(component.queryByText('No plants')).not.toBeNull();
        });
    });
});
