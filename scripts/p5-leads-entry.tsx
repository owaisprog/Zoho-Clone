import {createRoot} from "react-dom/client";
import {P5LeadWorkspace} from "../frontend/src/components/p5-lead-workspace";
import {createP5LeadClient} from "../frontend/src/lib/p5-leads-client";
const root=document.getElementById("root"),org=root?.getAttribute("data-org");
if(!root||!org)throw Error("P5_WORKSPACE_ROOT_MISSING");
createRoot(root).render(<P5LeadWorkspace organizationId={org} client={createP5LeadClient()}/>);
