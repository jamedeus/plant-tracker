import React, { memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getSelectedItems } from 'src/components/EditableNodeList';
import FloatingFooter from 'src/components/FloatingFooter';

// Helper component renders action buttons for one or more EditableNodeList.
//
// The visible prop (bool) must match EditableNodeList editing prop(s).
// The formRefs prop is an array of formRef props for each EditableNodeList.
// The onClose prop must set visible to false (minimum, can do other stuff too).
//
// Shows initialText when no items are selected, fades to number of selected
// when first item selected (itemName prop changes what they are called). Text
// changes immediately when number selected increments or decrements (no fade).
//
// Text will fade to alternateText prop when set to a non-empty string and fade
// back when set to an empty string (use to show success message, error, etc).
//
// The closeButton and testId props are passed to FloatingFooter.
const EditableNodeListActions = memo(function EditableNodeListActions({
    visible,
    formRefs,
    onClose,
    itemName,
    initialText,
    alternateText,
    closeButton=false,
    closeButtonAriaLabel,
    testId,
    children,
}) {
    // Track total selected items (shown in footer text)
    const [totalSelected, setTotalSelected] = useState(0);
    // Controls text shown in footer
    const [footerText, setFooterText] = useState('');
    // Controls whether there is a fade transition when footer text changes
    // Should fade when all text changes but not when number of selected changes
    const [shouldFade, setShouldFade] = useState(false);

    // Get total number of selected items from all formRefs
    const getTotalSelected = () => {
        return formRefs.reduce((total, formRef) => {
            return total + getSelectedItems(formRef).length;
        }, 0);
    };

    // Updates total selected items count + text shown in footer
    const updateSelectedCount = () => {
        const newTotalSelected = getTotalSelected();
        // Fade text when first item selected or last item unselected
        // (first selected: total=0 new=1, last unselected: total=1 new=0)
        setShouldFade(
            totalSelected + newTotalSelected === 1 ||
            totalSelected === newTotalSelected
        );
        setTotalSelected(newTotalSelected);
        // Show number of selected items in footer (or initialText if none)
        setFooterText(newTotalSelected > 0 ? (
            `${newTotalSelected} ${itemName}${newTotalSelected !== 1 ? 's' : ''} selected`
        ) : (
            initialText
        ));
    };

    // Set correct footer text when opened (initialText or number selected)
    useEffect(() => {
        visible && updateSelectedCount();
    }, [visible]);

    // Update total selected count when user checks/unchecks checkboxes
    useEffect(() => {
        // Only update when footer is visible
        if (!visible) {
            return;
        }

        // Add listeners to form(s) to update count
        formRefs.forEach(formRef => {
            formRef.current?.addEventListener('change', updateSelectedCount);
        });

        // Remove event listeners when component unmounts (don't stack)
        return () => {
            formRefs.forEach(formRef => {
                formRef.current?.removeEventListener('change', updateSelectedCount);
            });
        };
    }, [formRefs, totalSelected, visible]);

    // Show alternate text when it changes, hide when changed to empty string
    useEffect(() => {
        if (alternateText) {
            setShouldFade(true);
            setFooterText(alternateText);
        } else {
            setShouldFade(true);
            updateSelectedCount();
        }
    }, [alternateText]);

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

EditableNodeListActions.propTypes = {
    visible: PropTypes.bool.isRequired,
    formRefs: PropTypes.arrayOf(
        PropTypes.oneOfType([
            PropTypes.func,
            PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
        ])
    ).isRequired,
    onClose: PropTypes.func.isRequired,
    itemName: PropTypes.string.isRequired,
    initialText: PropTypes.string.isRequired,
    alternateText: PropTypes.string,
    closeButton: PropTypes.bool,
    closeButtonAriaLabel: PropTypes.string,
    testId: PropTypes.string,
    children: PropTypes.node.isRequired,
};

export default EditableNodeListActions;
