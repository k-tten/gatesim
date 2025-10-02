import { IS_MAC_OS } from "../circular";
import {
    ACTIVATED_CSS_COLOR,
    DELAY,
    GET_ACTIVATED_COLOR,
    GET_GRAY_COLOR,
    LOCKED_FOR_TESTING,
    TOAST_DURATION,
} from "../constants";
import { CanvasManager } from "../managers/CanvasManager";
import { DraggingManager } from "../managers/DraggingManager";
import { KeybindsManager } from "../managers/KeybindsManager";
import { SandboxManager } from "../managers/SandboxManager";
import { TestingManager } from "../managers/TestingManager";
import { ToastManager } from "../managers/ToastManager";
import { NewWireContext, Wiring, WiringManager } from "../managers/WiringManager";
import { Reified, computeTransformOrigin, html } from "./Reified";

export class SevenSegmentDisplay extends Reified {
    readonly element;

    inputs;
    outputs;
    readonly display;

    readonly #observers = new Map<Element, MutationObserver>();
    readonly #mouseups = new Map<Element, () => void>();
    readonly #contextmenus = new Map<Element, () => void>();
    readonly #clicks = new Map<Element, () => void>();

    #angle = 0;

    readonly #ctx;

    constructor(pos: { x: number; y: number; centered?: boolean } = { x: 0, y: 0 }) {
        super();

        this.element = html`
            <div class="display">
                <div class="component-inputs">
                    ${Array(8).fill('<button class="component-input-button">I</button>').join("")}
                </div>
                <canvas class="seven-segment-display"></canvas>
                <div class="component-outputs">
                    ${Array(0).fill('<button class="component-output-button">O</button>').join("")}
                </div>
            </div>
        `;

        this.inputs = Array.from(this.element.querySelectorAll<HTMLElement>(".component-input-button"));
        this.outputs = Array.from(this.element.querySelectorAll<HTMLElement>(".component-output-button"));
        this.display = this.element.querySelector<HTMLCanvasElement>(".seven-segment-display")!;

        this.display.height = 100 * devicePixelRatio;
        this.display.width = 80 * devicePixelRatio;

        this.#ctx = this.display.getContext("2d")!;

        this.#updateListeners();

        requestAnimationFrame(() => this.update());

        this.move(pos);
    }

    render() {
        this.#ctx.clearRect(0, 0, this.display.width, this.display.height);

        const out = this.inputs.map((i) => i.classList.contains("activated"));

        // define all our segments
        const segments = [
            {
                x: 2,
                y: 45,
                width: 24,
                height: 10,
            },
            {
                x: 32,
                y: 6,
                width: 32,
                height: 14,
            },
            {
                x: 60,
                y: 16,
                width: 14,
                height: 32,
            },
            {
                x: 60,
                y: 52,
                width: 14,
                height: 32,
            },
            {
                x: 32,
                y: 80,
                width: 32,
                height: 14,
            },
            {
                x: 22,
                y: 52,
                width: 14,
                height: 32,
            },
            {
                x: 22,
                y: 16,
                width: 14,
                height: 32,
            },
            {
                x: 32,
                y: 43,
                width: 32,
                height: 14,
            },
        ].map(({ x, y, width, height }) => ({
            x: x * devicePixelRatio,
            y: y * devicePixelRatio,
            width: width * devicePixelRatio,
            height: height * devicePixelRatio,
        }));

        segments.forEach(({ x, y, width, height }, i) => {
            this.#ctx.fillStyle = out[i] ? GET_ACTIVATED_COLOR() : GET_GRAY_COLOR();
            this.#ctx.strokeStyle = "black";

            this.#ctx.beginPath();

            if (width > height) {
                this.#ctx.moveTo(x, y + height / 2);
                this.#ctx.lineTo(x + height / 2, y);
                this.#ctx.lineTo(x + width - height / 2, y);
                this.#ctx.lineTo(x + width, y + height / 2);
                this.#ctx.lineTo(x + width - height / 2, y + height);
                this.#ctx.lineTo(x + height / 2, y + height);
            } else {
                this.#ctx.moveTo(x + width / 2, y);
                this.#ctx.lineTo(x, y + width / 2);
                this.#ctx.lineTo(x, y + height - width / 2);
                this.#ctx.lineTo(x + width / 2, y + height);
                this.#ctx.lineTo(x + width, y + height - width / 2);
                this.#ctx.lineTo(x + width, y + width / 2);
            }

            this.#ctx.closePath();

            this.#ctx.stroke();
            this.#ctx.fill();
        });
    }

    async update() {
        await DELAY(
            Reified.GATE_DELAY + Math.random() * (2 * Reified.GATE_DELAY_VARIATION) - Reified.GATE_DELAY_VARIATION,
        );

        this.render();

        return this;
    }

    get angle() {
        return this.#angle;
    }

    set angle(v: number) {
        this.#angle = v % 360;

        this.element.style.transform = `rotateZ(${v}deg)`;

        if (v === 180) {
            this.display.style.transform = `rotateZ(${v}deg)`;
        } else {
            this.display.style.transform = "";
        }

        this.element.style.transformOrigin = computeTransformOrigin(this.element);
    }

    rotate(angle: number): this {
        this.angle = angle;

        return this;
    }

    attach() {
        super.attach();

        this.#attachListeners();

        DraggingManager.watch(this.element, this.display);

        CanvasManager.addJob(this.render.bind(this));

        return this;
    }

    detach() {
        super.detach();

        this.#destroyListeners();

        DraggingManager.forget(this.element, true);

        CanvasManager.deleteJob(this.render.bind(this));

        return this;
    }

    #updateListeners() {
        this.#observers.clear();
        this.#mouseups.clear();
        this.#contextmenus.clear();
        this.#clicks.clear();

        this.inputs.forEach((input) => {
            this.#observers.set(input, new MutationObserver(this.update.bind(this)));

            this.#mouseups.set(input, () => input.blur());

            this.#contextmenus.set(input, () => {
                SandboxManager.queueNewContext(() => [
                    {
                        "delete-connections": {
                            label: "Delete connections",
                            keybind: IS_MAC_OS ? "⬆ ⌘ X" : "Ctrl Shift X",
                            callback: () => {
                                if (TestingManager.testing) return LOCKED_FOR_TESTING();

                                const deleted: Element[] = [];

                                return SandboxManager.pushHistory(
                                    () => {
                                        WiringManager.wires.forEach((wire) => {
                                            if (wire.to === input) {
                                                wire.destroy();

                                                deleted.push(wire.from);
                                            }
                                        });

                                        input.classList.remove("activated");
                                    },
                                    () => {
                                        WiringManager.wires.addAll(
                                            deleted.splice(0, deleted.length).map((from) => new Wiring(from, input)),
                                        );
                                    },
                                );
                            },
                        },
                    },
                ]);
            });
        });

        this.outputs.forEach((output) => {
            this.#mouseups.set(output, () => output.blur());

            this.#contextmenus.set(output, () => {
                SandboxManager.queueNewContext(() => [
                    {
                        "create-connection": {
                            label: "Create connection",
                            keybind: "Q",
                            stopPropagation: true,
                            callback: () => {
                                if (TestingManager.testing) return LOCKED_FOR_TESTING();

                                NewWireContext.from = output;

                                return undefined;
                            },
                        },
                        "delete-connections": {
                            label: "Delete connections",
                            keybind: IS_MAC_OS ? "⬆ ⌘ X" : "Ctrl Shift X",
                            callback: () => {
                                if (TestingManager.testing) return LOCKED_FOR_TESTING();

                                const deleted: Element[] = [];

                                return SandboxManager.pushHistory(
                                    () => {
                                        WiringManager.wires.forEach((wire) => {
                                            if (wire.from === output) {
                                                wire.destroy();

                                                wire.to.classList.remove("activated");

                                                deleted.push(wire.to);
                                            }
                                        });
                                    },
                                    () => {
                                        WiringManager.wires.addAll(
                                            deleted.splice(0, deleted.length).map((to) => new Wiring(output, to)),
                                        );
                                    },
                                );
                            },
                        },
                    },
                ]);
            });

            this.#clicks.set(output, () => {
                if (KeybindsManager.isKeyDown("KeyQ")) NewWireContext.from = output;
            });
        });

        this.#contextmenus.set(this.display, () => {
            SandboxManager.queueNewContext(() => [
                {
                    "rotate-component": {
                        label: "Rotate component",
                        keybind: "R",
                        callback: () => {
                            if (TestingManager.testing) return LOCKED_FOR_TESTING();

                            return SandboxManager.pushHistory(
                                () => {
                                    this.angle += 90;
                                },
                                () => {
                                    this.angle -= 90;
                                },
                            );
                        },
                    },
                },
                {
                    "delete-component": {
                        label: "Delete component",
                        keybind: IS_MAC_OS ? "⌘ X" : "Ctrl X",
                        callback: () => {
                            if (this.PERMANENT)
                                return void ToastManager.toast({
                                    message: "This component is permanent and cannot be deleted.",
                                    color: ACTIVATED_CSS_COLOR,
                                    duration: TOAST_DURATION,
                                });

                            if (TestingManager.testing) return LOCKED_FOR_TESTING();

                            const deleted: [from: Element, to: Element][] = [];

                            return SandboxManager.pushHistory(
                                () => {
                                    Reified.active.delete(this);

                                    this.detach();

                                    WiringManager.wires.forEach((wire) => {
                                        if (
                                            this.inputs.some((i) => wire.to === i) ||
                                            this.outputs.some((o) => wire.from === o)
                                        ) {
                                            wire.destroy();

                                            wire.to.classList.remove("activated");

                                            deleted.push([wire.from, wire.to]);
                                        }
                                    });

                                    this.inputs.forEach((i) => i.classList.remove("activated"));
                                },
                                () => {
                                    Reified.active.add(this);

                                    this.attach();

                                    WiringManager.wires.addAll(
                                        deleted.splice(0, deleted.length).map(([from, to]) => new Wiring(from, to)),
                                    );
                                },
                            );
                        },
                    },
                    "delete-connections": {
                        label: "Delete connections",
                        keybind: IS_MAC_OS ? "⬆ ⌘ X" : "Ctrl Shift X",
                        callback: () => {
                            if (TestingManager.testing) return LOCKED_FOR_TESTING();

                            const deleted: [from: Element, to: Element][] = [];

                            return SandboxManager.pushHistory(
                                () => {
                                    WiringManager.wires.forEach((wire) => {
                                        if (
                                            this.inputs.some((i) => wire.to === i) ||
                                            this.outputs.some((o) => wire.from === o)
                                        ) {
                                            wire.destroy();

                                            wire.to.classList.remove("activated");

                                            deleted.push([wire.from, wire.to]);
                                        }
                                    });

                                    this.inputs.forEach((i) => i.classList.remove("activated"));
                                },
                                () => {
                                    WiringManager.wires.addAll(
                                        deleted.splice(0, deleted.length).map(([from, to]) => new Wiring(from, to)),
                                    );
                                },
                            );
                        },
                    },
                },
            ]);
        });
    }

    #attachListeners() {
        this.inputs.forEach((input) => {
            this.#observers.get(input)!.observe(input, {
                attributes: true,
                attributeFilter: ["class"],
            });

            input.addEventListener("mouseup", this.#mouseups.get(input)!);

            input.addEventListener("contextmenu", this.#contextmenus.get(input)!);
        });

        this.outputs.forEach((output) => {
            output.addEventListener("mouseup", this.#mouseups.get(output)!);

            output.addEventListener("contextmenu", this.#contextmenus.get(output)!);

            output.addEventListener("click", this.#clicks.get(output)!);
        });

        this.display.addEventListener("contextmenu", this.#contextmenus.get(this.display)!);
    }

    #destroyListeners() {
        this.#observers.forEach((o) => o.disconnect());

        this.#mouseups.forEach((listener, element) => element.removeEventListener("mouseup", listener));

        this.#contextmenus.forEach((listener, element) => element.removeEventListener("contextmenu", listener));

        this.#clicks.forEach((listener, element) => element.removeEventListener("click", listener));

        this.display.removeEventListener("contextmenu", this.#contextmenus.get(this.display)!);
    }
}
