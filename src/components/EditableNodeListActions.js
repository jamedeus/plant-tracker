import React, { memo, useMemo, useRef, useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import PropTypes from 'prop-types';
import FloatingFooter from 'src/components/FloatingFooter';
import controllerPropTypes from 'src/types/editableNodeListControllerPropTypes';

// Helper component renders action buttons for one or more EditableNodeList.
//
// The visible prop (bool) must match EditableNodeList editing prop(s).
// The controllers prop is an array of selection controllers for each list.
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
    controllers,
    onClose,
    itemName,
    initialText,
    alternateText,
    closeButton=false,
    closeButtonAriaLabel,
    testId,
    children,
}) {
    // Merge subscribe methods from all controllers into single callback
    const subscribe = useCallback((listener) => {
        // Store unsubscribe function returned by each subscribe call
        const unsubscribers = controllers.map((controller) =>
            controller?.subscribe ? controller.subscribe(listener) : () => {}
        );
        // Return single function that calls all unsubscribe functions
        return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    }, [controllers]);

    // Merge getSnapshot methods from all controllers into single callback
    // Returns number of selected items in all controllers combined
    const getSnapshot = useCallback(() => {
        return controllers.reduce((total, controller) => {
            if (!controller) return total;
            return total + controller.getSnapshot().size;
        }, 0);
    }, [controllers]);

    // Read total number of selected items from controllers
    // Updates (render) when other components manipulate controller selection
    const totalSelected = useSyncExternalStore(subscribe, getSnapshot);

    // Tracks number selected in previous render
    // Used to detect when first selected/last unselected
    const previousTotalRef = useRef(totalSelected);

    // Controls whether there is a fade transition when footer text changes
    // Should fade when all text changes but not when number of selected changes
    const shouldFade = useMemo(() => {
        // Read total from previous run, overwrite with current for next run
        const prevTotal = previousTotalRef.current;
        previousTotalRef.current = totalSelected;

        // Fade if alternateText set
        if (alternateText) return true;

        // Fade text when first item selected or last item unselected
        // (first selected: total=0 new=1, last unselected: total=1 new=0)
        // Also fade when number did not change (text manually changed)
        return prevTotal + totalSelected === 1 || prevTotal === totalSelected;
    }, [alternateText, totalSelected, visible]);

    // Controls text shown in footer
    const footerText = alternateText || (
        totalSelected > 0
            ? `${totalSelected} ${itemName}${totalSelected !== 1 ? 's' : ''} selected`
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

EditableNodeListActions.propTypes = {
    visible: PropTypes.bool.isRequired,
    controllers: PropTypes.arrayOf(controllerPropTypes).isRequired,
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
