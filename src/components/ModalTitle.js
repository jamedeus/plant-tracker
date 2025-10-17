import PropTypes from 'prop-types';

const ModalTitle = ({ title }) => (
    <h3 className="font-bold text-lg leading-8 md:text-xl mb-3">
        {title}
    </h3>
);

ModalTitle.propTypes = {
    title: PropTypes.string.isRequired
};

export default ModalTitle;
