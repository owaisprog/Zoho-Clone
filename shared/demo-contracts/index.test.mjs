import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_CONTRACT, isSyntheticLead, isSyntheticApplication, parseSyntheticEnvelope } from "./index.js";

const lead = {id:"LEAD-DEMO-101",organization:"Northstar Commerce Demo",contact:"Example Contact A",email:"contact-a@example.com",stage:"qualified",owner:"Demo Sales"};
const app = {id:"APP-DEMO-101",name:"Demo River Retail",category:"Retail",stage:"draft",owner:"Demo Operations",nextAction:"Review synthetic checklist",updatedLabel:"Today (demo)"};
const wrap = (dataset, records) => ({contract:DEMO_CONTRACT,scope:"synthetic-only",dataset,records});

describe("P3.04 shared fictional-only contracts", () => {
  it("accepts the exact allowlisted fictional row", () => {
    assert.equal(isSyntheticLead(lead), true);
    assert.equal(isSyntheticApplication(app), true);
    assert.deepEqual(parseSyntheticEnvelope(wrap("leads",[lead]),"leads",[lead]),[lead]);
    assert.deepEqual(parseSyntheticEnvelope(wrap("applications",[app]),"applications",[app]),[app]);
  });
  it("rejects real contacts, unexpected fields and forged statuses", () => {
    assert.equal(isSyntheticLead({...lead,email:"actual@company.com"}), false);
    assert.equal(isSyntheticLead({...lead,tenantId:"secret"}), false);
    assert.equal(isSyntheticApplication({...app,stage:"processor_approved"}), false);
  });
  it("rejects altered values even when an attacker preserves fictional-looking fields", () => {
    assert.equal(parseSyntheticEnvelope(wrap("leads",[{...lead,organization:"New Demo Customer"}]),"leads",[lead]),null);
    assert.equal(parseSyntheticEnvelope(wrap("leads",[{...lead,contact:"Example Secret"}]),"leads",[lead]),null);
  });
  it("fails closed for extra envelope keys, mismatched contract and duplicates", () => {
    assert.equal(parseSyntheticEnvelope({...wrap("leads",[lead]),debug:true},"leads",[lead]),null);
    assert.equal(parseSyntheticEnvelope({...wrap("leads",[lead]),contract:"production"},"leads",[lead]),null);
    assert.equal(parseSyntheticEnvelope(wrap("leads",[lead,lead]),"leads",[lead,lead]),null);
    assert.equal(parseSyntheticEnvelope(wrap("leads",[lead]),"applications",[app]),null);
  });
});
