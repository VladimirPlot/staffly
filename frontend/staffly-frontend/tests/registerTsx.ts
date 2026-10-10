// register() is available in the pinned Node 22.13 runtime.
import { register } from "node:module";

register("./tsxLoader.mjs", import.meta.url);
