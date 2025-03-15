import { PageWrapper } from 'src/index';
import AddPlantsModal, { openAddPlantsModal } from '../AddPlantsModal';
import { mockContext } from './mockContext';

describe('AddPlantsModal', () => {
    it('renders a card for each plant option', async () => {
        // Get output of getAddPlantsModalOptions (from App component)
        const existing = mockContext.details.map(plant => plant.uuid);
        const options = mockContext.options.filter(
            plant => !existing.includes(plant.uuid) && !plant.archived
        );

        // Render modal with mock context
        const component = render(
            <PageWrapper>
                <AddPlantsModal
                    options={options}
                    addPlants={jest.fn()}
                />
            </PageWrapper>
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
        // Render modal with no plant options
        const component = render(
            <PageWrapper>
                <AddPlantsModal
                    options={[]}
                    addPlants={jest.fn()}
                />
            </PageWrapper>
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
