// Utilities to emulate django's json_script tags for transitional SPA mounts

function writeJsonScriptElement(id, data) {
    const existing = document.getElementById(id);
    if (existing) {
        existing.remove();
    }
    const script = document.createElement('script');
    script.type = 'application/json';
    script.id = id;
    script.textContent = JSON.stringify(data);
    document.body.appendChild(script);
}

function writeStateMap(stateMap) {
    Object.entries(stateMap).forEach(([key, value]) => {
        writeJsonScriptElement(key, value);
    });
}

export { writeJsonScriptElement, writeStateMap };


