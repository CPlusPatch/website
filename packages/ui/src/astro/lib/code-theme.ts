import { createCssVariablesTheme } from "shiki/core";
import {
    CODE_VARIABLE_DEFAULTS,
    CODE_VARIABLE_PREFIX,
} from "../../lib/code-theme.ts";

/** The Shiki theme for <Code>; see lib/code-theme.ts for the colours. */
export const codeTheme = createCssVariablesTheme({
    name: "website",
    variablePrefix: CODE_VARIABLE_PREFIX,
    variableDefaults: CODE_VARIABLE_DEFAULTS,
});
