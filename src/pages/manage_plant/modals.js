// Helper to allow importing openModal functions instead of prop drilling.
//
// Component that mounts LazyModal must import set*ModalHandle and pass it the
// return value from useModal.
//
// Components that need to open modal can then import open*Modal.

let noteModalHandle;

export const setNoteModalHandle = (handle) => {
    noteModalHandle = handle;
};

export const openNoteModal = (note) => {
    noteModalHandle?.open({ note: note});
    document.activeElement.blur();
};

let repotModalHandle;

export const setRepotModalHandle = (handle) => {
    repotModalHandle = handle;
};

export const openRepotModal = (openChangeQrModal) => {
    repotModalHandle?.open({ openChangeQrModal: openChangeQrModal });
    document.activeElement.blur();
};

let changeQrModalHandle;

export const setChangeQrModalHandle = (handle) => {
    changeQrModalHandle = handle;
};

export const openChangeQrModal = (uuid) => {
    changeQrModalHandle?.open({ uuid: uuid });
    document.activeElement.blur();
};
