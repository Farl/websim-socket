import { routePartykitRequest } from "partyserver";
import { WebsimServer } from "./index";
export { WebsimServer };

type Env = { Main: DurableObjectNamespace<WebsimServer> };

// Main preserves the existing /parties/main/:room wire protocol.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
