import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import RemovePlantsModal from '../RemovePlantsModal';
import { mockContext } from './mockContext';

describe('RemovePlantsModal', () => {
    it('renders a card for each plant option', async () => {
        // Render context with mock context
        const component = render(
            <ErrorModalProvider>
                <RemovePlantsModal
                    groupID={mockContext.group.uuid}
                    plantDetails={mockContext.details}
                    setPlantDetails={jest.fn()}
                />
            </ErrorModalProvider>
        );

        // Confirm an option was rendered for each plant in plantDetails
        const titles = component.container.querySelectorAll('.card-title');
        expect(titles.length).toBe(3);
        expect(titles[0].innerHTML).toBe("Test Plant");
        expect(titles[1].innerHTML).toBe("Unnamed Spider Plant");
        expect(titles[2].innerHTML).toBe("Newest plant");
    });

    it('renders expected text when no plant options', async () => {
        // Render modal with no plantDetails (contains current plants in group)
        const component = render(
            <ErrorModalProvider>
                <RemovePlantsModal
                    groupID={mockContext.group.uuid}
                    plantDetails={[]}
                    setPlantDetails={jest.fn()}
                />
            </ErrorModalProvider>
        );

        // Confirm no cards, confirm expected text
        const titles = component.container.querySelectorAll('.card-title');
        expect(titles.length).toBe(0);
        expect(component.queryByText('No plants')).not.toBeNull();
    });
});
