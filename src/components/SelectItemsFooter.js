import React, { memo, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import FloatingFooter from 'src/components/FloatingFooter';

// Helper component renders controls for features that involve selecting items.
//
// The visible prop (bool) hides/shows the footer, onClose must set it to false.
// The itemsSelected prop (int) must update when items are selected/unselected.
//
// Shows initialText when no items are selected, fades to number of selected
// when first item selected (itemName prop changes what they are called). Text
// changes immediately when number selected increments or decrements (no fade).
//
// Text will fade to alternateText prop when set to a non-empty string and fade
// back when set to an empty string (use to show success message, error, etc).
//
// The closeButton and testId props are passed to FloatingFooter.
const SelectItemsFooter = memo(function SelectItemsFooter({
    visible,
    onClose,
    itemName,
    itemsSelected,
    initialText,
    alternateText,
    closeButton=false,
    closeButtonAriaLabel,
    testId,
    children,
}) {
    // Tracks number selected in previous render
    // Used to detect when first selected/last unselected
    const previousTotalRef = useRef(itemsSelected);

    // Controls whether there is a fade transition when footer text changes
    // Should fade when all text changes but not when number of selected changes
    const shouldFade = useMemo(() => {
        // Read total from previous run, overwrite with current for next run
        const prevTotal = previousTotalRef.current;
        previousTotalRef.current = itemsSelected;

        // Fade if alternateText set
        if (alternateText) return true;

        // Fade text when first item selected or last item unselected
        // (first selected: total=0 new=1, last unselected: total=1 new=0)
        // Also fade when number did not change (text manually changed)
        return prevTotal + itemsSelected === 1 || prevTotal === itemsSelected;
    }, [alternateText, itemsSelected, visible]);

    // Controls text shown in footer
    const footerText = alternateText || (
        itemsSelected > 0
            ? `${itemsSelected} ${itemName}${itemsSelected !== 1 ? 's' : ''} selected`
            : initialText
    );

    return (
        <FloatingFooter
            visible={visible}
            text={footerText}
            fadeText={shouldFade}
            onClose={onClose}
            closeButton={closeButton}
            closeButtonAriaLabel={closeButtonAriaLabel}
            testId={testId}
        >
            {children}
        </FloatingFooter>
    );
});

SelectItemsFooter.propTypes = {
    visible: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    itemName: PropTypes.string.isRequired,
    itemsSelected: PropTypes.number.isRequired,
    initialText: PropTypes.string.isRequired,
    alternateText: PropTypes.string,
    closeButton: PropTypes.bool,
    closeButtonAriaLabel: PropTypes.string,
    testId: PropTypes.string,
    children: PropTypes.node.isRequired,
};

export default SelectItemsFooter;
