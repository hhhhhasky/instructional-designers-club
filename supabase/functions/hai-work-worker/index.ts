import { handleWorkWorker } from "./handler.ts";
Deno.serve((request) => handleWorkWorker(request));
