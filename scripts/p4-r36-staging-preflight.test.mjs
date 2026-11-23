import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluateP4R36StagingBlueprint}
 from "./p4-r36-staging-preflight.mjs";
const blueprint=JSON.parse(readFileSync(new URL(
 "../docs/engineering/p4-r36-staging-blueprint.json",import.meta.url),"utf8"));
const gates=JSON.parse(readFileSync(new URL(
 "../docs/engineering/p4-release-gates.json",import.meta.url),"utf8"));
const bad=(b,g=gates)=>{
 const r=evaluateP4R36StagingBlueprint(b,g);
 assert.equal(r.valid,false);assert.equal(r.release,"NO_GO");
 assert.equal(r.deploymentPermitted,false);
};
test("R36 pinned official open gates and dry-run blueprint remain blocked",()=>{
 const result=evaluateP4R36StagingBlueprint(blueprint,gates);
 assert.equal(result.valid,true);
 assert.equal(result.release,"NO_GO");
 assert.equal(result.deploymentPermitted,false);
});
test("R36 denies any suggested deployment action",()=>{
 bad({...blueprint,publicIngress:"ENABLED"});
 bad({...blueprint,forbiddenActions:blueprint.forbiddenActions.filter(x=>x!=="DEPLOY")});
 bad({...blueprint,permittedActions:[...blueprint.permittedActions,"DEPLOY"]});
});
test("R36 denies owner auto-approval or reset acceptance count",()=>{
 bad({...blueprint,approval:{...blueprint.approval,security:true}});
 bad({...blueprint,formalAcceptance:{...blueprint.formalAcceptance,executed:727}});
});
test("R36 denies false claims that live staging or real identities are connected",()=>{
 bad({...blueprint,dependencies:{...blueprint.dependencies,
  auth0:{...blueprint.dependencies.auth0,state:"CONNECTED"}}});
 bad({...blueprint,rollback:{...blueprint.rollback,automaticDeployment:true}});
});
test("R36 rejects changed official release gates or silent owner exit",()=>{
 bad(blueprint,{...gates,ownerExitApproved:true});
 bad(blueprint,{...gates,gates:gates.gates.map((x,i)=>
  i===0?{...x,status:"CLOSED"}:x)});
});
