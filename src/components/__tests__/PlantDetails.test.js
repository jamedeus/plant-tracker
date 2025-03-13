import PlantDetails from '../PlantDetails';

describe('PlantDetails', () => {
    it('displays correct details', () => {
        const { getByText, queryByText } = render(
            <PlantDetails
                species='Fittonia'
                pot_size={4}
                description='Propagated in March 2023'
            />
        );
        expect(getByText('Fittonia')).toBeInTheDocument();
        expect(getByText('4')).toBeInTheDocument();
        expect(getByText('Propagated in March 2023')).toBeInTheDocument();
        expect(queryByText('No details')).toBeNull();
    });

    it('does not render species row if argument is null', () => {
        const { queryByText } = render(
            <PlantDetails
                species={null}
                pot_size={4}
                description='Propagated in March 2023'
            />
        );
        expect(queryByText('Species:')).toBeNull();
        expect(queryByText('Description:')).toBeInTheDocument();
    });

    it('does not render pot_size row if argument is null', () => {
        const { queryByText } = render(
            <PlantDetails
                species='Fittonia'
                pot_size={null}
                description='Propagated in March 2023'
            />
        );
        expect(queryByText('Pot size:')).toBeNull();
        expect(queryByText('Description:')).toBeInTheDocument();
    });

    it('does not render description row if argument is null', () => {
        const { queryByText } = render(
            <PlantDetails
                species='Fittonia'
                pot_size={4}
                description={null}
            />
        );
        expect(queryByText('Species:')).toBeInTheDocument();
        expect(queryByText('Description:')).toBeNull();
    });

    it('displays "No details" when both arguments are null', () => {
        const { getByText, queryByText } = render(
            <PlantDetails species={null} pot_size={null} description={null} />
        );
        expect(getByText('No details')).toBeInTheDocument();
        expect(queryByText('Description:')).toBeNull();
    });
});
