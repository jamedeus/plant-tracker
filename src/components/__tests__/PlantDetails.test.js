import { render } from '@testing-library/react';
import PlantDetails from '../PlantDetails';
import '@testing-library/jest-dom';

describe('App', () => {
    it('displays correct details', () => {
        const { getByText, queryByText } = render(
            <PlantDetails
                species={"Fittonia"}
                pot_size={4}
                description={"Propagated in March 2023"}
            />
        );
        expect(getByText('Fittonia')).toBeInTheDocument();
        expect(getByText('4')).toBeInTheDocument();
        expect(getByText('Propagated in March 2023')).toBeInTheDocument();
        expect(queryByText('No details')).toBeNull();
    });

    it('hides species row if argument is null', () => {
        const { getByText } = render(
            <PlantDetails
                species={null}
                pot_size={4}
                description={"Propagated in March 2023"}
            />
        );
        expect(getByText('Species:').parentElement.classList).toContain('hidden');
        expect(getByText('Description:').parentElement.classList).not.toContain('hidden');
    });

    it('hides pot_size row if argument is null', () => {
        const { getByText } = render(
            <PlantDetails
                species={"Fittonia"}
                pot_size={null}
                description={"Propagated in March 2023"}
            />
        );
        expect(getByText('Pot size:').parentElement.classList).toContain('hidden');
        expect(getByText('Description:').parentElement.classList).not.toContain('hidden');
    });

    it('hides description row if argument is null', () => {
        const { getByText } = render(
            <PlantDetails
                species={"Fittonia"}
                pot_size={4}
                description={null}
            />
        );
        expect(getByText('Species:').parentElement.classList).not.toContain('hidden');
        expect(getByText('Description:').parentElement.classList).toContain('hidden');
    });

    it('displays "No details" when both arguments are null', () => {
        const { getByText, queryByText } = render(
            <PlantDetails species={null} pot_size={null} description={null} />
        );
        expect(getByText('No details')).toBeInTheDocument();
        expect(queryByText('Description:')).toBeNull();
    });
});
