import {createRoot} from "react-dom/client";
import {StagingPermissionWorkspace} from "../frontend/src/components/staging-permission-workspace";
import {createPermissionWorkspaceTransport} from "../frontend/src/lib/stage-permission-workspace";
const root=document.getElementById("root");
if(!root)throw Error("P4_WORKSPACE_ROOT_MISSING");
createRoot(root).render(<StagingPermissionWorkspace transport={createPermissionWorkspaceTransport()}/>);
