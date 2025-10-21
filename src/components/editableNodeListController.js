import { useRef } from 'react';

// Returns object used to track subscribers + notify when selection changes
const createSubscriptionSet = () => {
    const listeners = new Set();

    return {
        add(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        notify() {
            listeners.forEach((listener) => listener());
        }
    };
};

// Clone helper keeps mutations off the live Set reference
const cloneSet = (set) => new Set(set);

// Takes array of initially selected keys, returns controller object.
// Components that subscribe to controller receive a Set of selected item keys.
// Usage: useSyncExternalStore(controller.subscribe, controller.getSnapshot).
export const createEditableNodeListController = (initialSelected = []) => {
    let selected = new Set(initialSelected);
    const subscriptions = createSubscriptionSet();

    return {
        // useSyncExternalStore first arg
        subscribe(listener) {
            return subscriptions.add(listener);
        },
        // useSyncExternalStore second arg
        getSnapshot() {
            return selected;
        },
        // Takes key, selects if unselected, unselects if selected
        toggle(key) {
            selected = cloneSet(selected);
            selected.has(key) ? selected.delete(key) : selected.add(key);
            subscriptions.notify();
        },
        // Takes array of keys, removes all from selection
        bulkUnselect(keys) {
            let didChange = false;
            const nextSelected = cloneSet(selected);
            Array.from(keys ?? []).forEach((key) => {
                if (nextSelected.delete(key)) {
                    didChange = true;
                }
            });
            if (didChange) {
                selected = nextSelected;
                subscriptions.notify();
            }
        }
    };
};

// Hook returns stable controller reference
export const useEditableNodeListController = (initialSelected = []) => {
    const controllerRef = useRef(null);

    if (!controllerRef.current) {
        controllerRef.current = createEditableNodeListController(initialSelected);
    }

    return controllerRef.current;
};
