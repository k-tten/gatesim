import { ACTIVATED_CSS_COLOR, DELAY, GET_BIN_PERMS, TOAST_DURATION } from "../constants";
import { Input } from "../reified/Input";
import { Output } from "../reified/Output";
import { Reified } from "../reified/Reified";
import { ModalManager } from "./ModalManager";
import { ToastManager } from "./ToastManager";
import { WiringManager } from "./WiringManager";

export class TestingManager {
    static #testing = false;

    static async test(cases: [inputs: boolean[], outputs: boolean[]][]) {
        if (this.#testing) return ModalManager.alert("Diagram is already under testing.");

        const inputs = [...Reified.active]
            .filter((component): component is Input => component instanceof Input)
            .sort((a, b) => parseFloat(a.element.style.top) - parseFloat(b.element.style.top));
        const outputs = [...Reified.active]
            .filter((component): component is Output => component instanceof Output)
            .sort((a, b) => parseFloat(a.element.style.top) - parseFloat(b.element.style.top));
        const components = [...Reified.active].filter(
            (component) => !(component instanceof Input) && !(component instanceof Output),
        );

        this.#testing = true;

        Reified.active.lock();
        WiringManager.wires.lock();

        const originalActivations = inputs.map((input) => input.element.classList.contains("activated"));
        const originalDelay = Reified.GATE_DELAY;
        const originalVariation = Reified.GATE_DELAY_VARIATION;

        Reified.GATE_DELAY = 25;
        Reified.GATE_DELAY_VARIATION = 0;

        for (const [givenInputs, expectedOutputs] of cases) {
            if (inputs.length !== givenInputs.length) throw new Error("Mismatched input lengths.");
            if (outputs.length !== expectedOutputs.length) throw new Error("Mismatched output lengths.");

            for (const [index, input] of inputs.entries()) {
                input.element.classList.toggle("activated", givenInputs[index]);
            }

            await DELAY(components.length * (25 * 2) + 50);

            const realOutputs = outputs.map((output) => output.element.classList.contains("activated"));

            if (!realOutputs.every((out, i) => out === expectedOutputs[i])) {
                await ModalManager.alert(
                    `Diagram failed to pass the test with inputs "${givenInputs
                        .map((boolean) => +boolean)
                        .join(" ")}".`,
                );

                originalActivations.forEach((value, i) => inputs[i].element.classList.toggle("activated", value));

                Reified.active.unlock();
                WiringManager.wires.unlock();

                this.#testing = false;

                return false;
            }

            await DELAY();
        }

        await ModalManager.alert("Diagram passed all the tests.");

        originalActivations.forEach((value, i) => inputs[i].element.classList.toggle("activated", value));
        Reified.GATE_DELAY = originalDelay;
        Reified.GATE_DELAY_VARIATION = originalVariation;

        Reified.active.unlock();
        WiringManager.wires.unlock();

        this.#testing = false;

        return true;
    }

    static get testing() {
        return this.#testing;
    }

    static async getTruthTable() {
        if (this.#testing) return ModalManager.alert("Diagram is already under testing.");

        const inputs = [...Reified.active]
            .filter((component): component is Input => component instanceof Input)
            .sort((a, b) => parseFloat(a.element.style.top) - parseFloat(b.element.style.top));
        const outputs = [...Reified.active]
            .filter((component): component is Output => component instanceof Output)
            .sort((a, b) => parseFloat(a.element.style.top) - parseFloat(b.element.style.top));
        const components = [...Reified.active].filter(
            (component) => !(component instanceof Input) && !(component instanceof Output),
        );

        if (!inputs.length)
            return void ToastManager.toast({
                message: "Can't create table without inputs.",
                color: ACTIVATED_CSS_COLOR,
                duration: TOAST_DURATION,
            });

        if (!outputs.length)
            return void ToastManager.toast({
                message: "Can't create table without outputs.",
                color: ACTIVATED_CSS_COLOR,
                duration: TOAST_DURATION,
            });

        this.#testing = true;

        Reified.active.lock();
        WiringManager.wires.lock();

        const originalActivations = inputs.map((input) => input.element.classList.contains("activated"));
        const originalDelay = Reified.GATE_DELAY;
        const originalVariation = Reified.GATE_DELAY_VARIATION;

        Reified.GATE_DELAY = 25;
        Reified.GATE_DELAY_VARIATION = 0;

        const table: boolean[][][] = [];

        for (const perm of GET_BIN_PERMS(inputs.length)) {
            for (const [index, input] of inputs.entries()) {
                input.element.classList.toggle("activated", perm[index]);
            }

            await DELAY(components.length * (25 * 2) + 50);

            const realOutputs = outputs.map((output) => output.element.classList.contains("activated"));

            table.push([perm, realOutputs]);

            await DELAY();
        }

        originalActivations.forEach((value, i) => inputs[i].element.classList.toggle("activated", value));
        Reified.GATE_DELAY = originalDelay;
        Reified.GATE_DELAY_VARIATION = originalVariation;

        Reified.active.unlock();
        WiringManager.wires.unlock();

        this.#testing = false;

        return table;
    }
}
