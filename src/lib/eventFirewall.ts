// src/lib/actions/clickOutside.ts
type Opts = {
    onOut: () => void;
    ignore?: Array<HTMLElement | null | undefined>; // nodos que NO disparan onOut
    // Si usas pointerdown para cerrar, deja true. Si no, cambia a ['click'].
    events?: Array<'pointerdown' | 'click'>;
};

export function clickOutside(node: HTMLElement, opts: Opts) {
    let { onOut, ignore = [], events = ['pointerdown', 'click'] } = opts;

    const isInside = (e: Event) => {
        const path = e.composedPath();
        if (path.includes(node)) return true;
        for (const ig of ignore) if (ig && path.includes(ig)) return true;
        return false;
    };

    const handler = (e: Event) => {
        // Si el evento inició en elementos “permitidos”, ignora
        if (isInside(e)) return;

        // Evita que otros “outside” cierren dos veces o reabran
        // (No bloquea navegación; no usamos preventDefault)
        e.stopPropagation();

        onOut();
    };

    // Registrar en captura para ganarle a listeners en burbujeo
    for (const ev of events) document.addEventListener(ev, handler, { capture: true });

    return {
        update(newOpts: Opts) {
            onOut = newOpts.onOut;
            ignore = newOpts.ignore ?? [];
            events = newOpts.events ?? ['pointerdown', 'click'];
        },
        destroy() {
            for (const ev of events) document.removeEventListener(ev, handler, { capture: true } as any);
        }
    };
}
