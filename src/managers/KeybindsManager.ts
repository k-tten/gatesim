import { IS_MAC_OS } from "../circular";
import { SandboxManager } from "./SandboxManager";

export class KeybindsManager {
    static #keymap = new Map<string, boolean>();

    static #keychords = new Array<[string, ((e: KeyboardEvent) => void)[]]>();

    static #keydown = (e: KeyboardEvent) => {
        this.#keymap.set(e.code, true);

        if (e.metaKey && (e.code === "ShiftLeft" || e.code === "ShiftRight") && IS_MAC_OS)
            this.#keymap = new Map([...this.#keymap.entries()].filter(([key]) => !key.startsWith("Key")));

        if (document.activeElement === document.body) {
            const [chord, runs] =
                this.#keychords.find(([chord]) => {
                    let keys = chord.split("+");

                    const checkShift = keys.includes("ShiftLeft") || keys.includes("ShiftRight");
                    const checkCtrl = keys.includes("ControlLeft") || keys.includes("ControlRight");
                    const checkAlt = keys.includes("AltLeft") || keys.includes("AltRight");
                    const checkMeta = keys.includes("MetaLeft") || keys.includes("MetaRight");

                    if (!checkShift && e.shiftKey) return false;
                    if (!checkCtrl && e.ctrlKey) return false;
                    if (!checkAlt && e.altKey) return false;
                    if (!checkMeta && e.metaKey) return false;

                    if (checkShift) keys = keys.filter((key) => key !== "ShiftLeft" && key !== "ShiftRight");
                    if (checkCtrl) keys = keys.filter((key) => key !== "ControlLeft" && key !== "ControlRight");
                    if (checkAlt) keys = keys.filter((key) => key !== "AltLeft" && key !== "AltRight");
                    if (checkMeta) keys = keys.filter((key) => key !== "MetaLeft" && key !== "MetaRight");

                    return (
                        (checkShift ? e.shiftKey : true) &&
                        (checkCtrl ? e.ctrlKey : true) &&
                        (checkAlt ? e.altKey : true) &&
                        (checkMeta ? e.metaKey : true) &&
                        keys.every((key) => this.#keymap.get(key))
                    );
                }) ?? [];

            if (runs) {
                SandboxManager.killMenu();

                runs.forEach((run) => run.call(undefined, e));

                chord!.split("+").forEach((key) => {
                    if (key.startsWith("Key")) this.#keymap.delete(key);
                });
            }
        }
    };

    static #keyup = (e: KeyboardEvent) => {
        this.#keymap.delete(e.code);

        if (!e.metaKey && (e.code === "MetaLeft" || e.code === "MetaRight") && IS_MAC_OS) this.#keymap.clear();
    };

    static #blur = () => {
        this.#keymap.clear();
    };

    static listen() {
        document.addEventListener("keydown", this.#keydown);
        document.addEventListener("keyup", this.#keyup);
        document.addEventListener("blur", this.#blur);

        return this;
    }

    static deafen() {
        document.removeEventListener("keydown", this.#keydown);
        document.removeEventListener("keyup", this.#keyup);
        document.removeEventListener("blur", this.#blur);

        return this;
    }

    static onKeyChord(chord: string, run: (e: KeyboardEvent) => void) {
        chord = chord.split("+").sort().join("+");

        if (!this.#keychords.find(([key]) => key === chord)?.[1].push(run)) this.#keychords.push([chord, [run]]);

        return this;
    }

    static isKeyDownAndNoFocus(key: string) {
        return !!this.#keymap.get(key) && document.activeElement === document.body;
    }

    static isKeyDown(key: string) {
        return !!this.#keymap.get(key);
    }

    static reset() {
        this.#keymap.clear();

        this.#keychords = [];

        this.deafen();

        return this;
    }

    static expand<S extends string>(chord: S): ExpandChord<S>[];
    static expand(chord: string) {
        const [key, ...rest] = chord.split("+");

        if (key === "Shift" || key === "Control" || key === "Alt" || key === "Meta")
            return rest.length
                ? this.expand(rest.join("+")).flatMap((keys) => [
                      [`${key}Left`, keys].join("+"),
                      [`${key}Right`, keys].join("+"),
                  ])
                : [`${key}Left`, `${key}Right`];

        if (key.length === 1 && key === key.toUpperCase())
            return rest.length
                ? this.expand(rest.join("+")).flatMap((keys) => [[`Key${key}`, keys].join("+")])
                : [`Key${key}`];

        return [chord];
    }

    static assign<S extends string, R extends (e: KeyboardEvent) => void>(chord: S, run: R): AssignChord<S, R>;
    static assign(chord: string, run: (e: KeyboardEvent) => void) {
        return Object.fromEntries(
            this.expand(chord)
                .map<[string, (e: KeyboardEvent) => void]>((keys) => [keys, run])
                .concat([[chord, run]]),
        );
    }
}

type Split<S extends string, D extends string = "", R extends readonly unknown[] = []> = S extends ""
    ? R
    : S extends `${infer A}${D}${infer B}`
    ? Split<B, D, [...R, A]>
    : [...R, S];

type Join<A, S extends string = "", R extends string = ""> = A extends [infer X extends string, ...infer Y]
    ? Join<Y, S, R extends "" ? X : `${R}${S}${X}`>
    : R;

type ExpandChord<S extends string, A extends string[] = Split<S, "+">> = Join<
    {
        [K in keyof A]: A[K] extends "Shift" | "Control" | "Alt" | "Meta"
            ? `${A[K]}${"Left" | "Right"}`
            : Split<A[K]>["length"] extends 1
            ? A[K] extends Uppercase<A[K]>
                ? `Key${A[K]}`
                : A[K]
            : A[K];
    },
    "+"
>;

type AssignChord<S extends string, R> = {
    [_ in S]: R;
} & {
    [K in ExpandChord<S> & PropertyKey]: R;
};
