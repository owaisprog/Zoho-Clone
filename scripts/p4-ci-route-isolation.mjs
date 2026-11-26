#!/usr/bin/env node
/**
 * P4 B19: fail-closed production source dependency guard for internal IAM.
 * Parse actual TypeScript syntax (including type imports) rather than examples
 * in generated Prisma comments. The compiled JavaScript guard remains separate.
 */
import {readFileSync,existsSync,realpathSync} from "node:fs";
import {resolve,dirname,extname,relative,sep} from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const sourceRoot=resolve(root,"backend/src");
const CI_MODULE=/(?:^|\/)(?:p4-(?:v1|r\d+)-ci-[^/]+|p4-r81-provider-tenant|p4-ci-[^/]+)(?:\.[jt]sx?)?$/;
const ALLOWED_EXT=new Set([".ts",".tsx",".mts",".cts"]);
function fail(path,reason){
 const file=relative(sourceRoot,path);
 const error=new Error("P4_CI_TEST_ROUTER_REACHABLE");
 // Only repository-relative source paths and fixed reason codes, never specifier text.
 error.sourceFile=inside(path)?file:"outside-source";
 error.reason=reason;
 throw error;
}
function inside(path){
 const rel=relative(sourceRoot,path);
 return rel!==""&&rel!==".."&&!rel.startsWith(".."+sep);
}
function importsOf(path,source){
 const file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
 if(file.parseDiagnostics.length)fail(path,"INVALID_SOURCE");
 const specs=[];
 function add(node){
  if(!node||!ts.isStringLiteral(node))fail(path,"NON_LITERAL_IMPORT");
  specs.push(node.text);
 }
 function visit(node){
  if(ts.isImportDeclaration(node))add(node.moduleSpecifier);
  else if(ts.isExportDeclaration(node)&&node.moduleSpecifier)add(node.moduleSpecifier);
  else if(ts.isImportEqualsDeclaration(node)&&ts.isExternalModuleReference(node.moduleReference))add(node.moduleReference.expression);
  else if(ts.isImportTypeNode(node)){
   if(!ts.isLiteralTypeNode(node.argument))fail(path,"NON_LITERAL_IMPORT_TYPE");
   add(node.argument.literal);
  }else if(ts.isCallExpression(node)){
   const callee=node.expression;
   if(callee.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(callee)&&callee.text==="require")){
    if(!node.arguments.length)fail(path,"NON_LITERAL_IMPORT");
    add(node.arguments[0]);
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(file);
 return specs;
}
export function inspectProductionGraph(read=readFileSync,exists=existsSync,canonical=p=>p){
 const visited=new Set();
 function visit(path){
  const abs=resolve(path);
  if(!inside(abs))fail(abs,"OUTSIDE_SOURCE");
  if(CI_MODULE.test(abs))fail(abs,"PROHIBITED_MODULE");
  if(visited.has(abs))return;
  visited.add(abs);
  for(const spec of importsOf(abs,read(abs,"utf8"))){
   if(!spec)fail(abs,"EMPTY_IMPORT");
   if(!spec.startsWith(".")){
    if(spec.startsWith("@zoho-clone/backend/")||spec.startsWith("@/"))fail(abs,"UNRESOLVED_ALIAS");
    continue;
   }
   const stem=resolve(dirname(abs),spec);
   if(!inside(stem))fail(abs,"OUTSIDE_SOURCE");
   if(CI_MODULE.test(stem.replace(/\.[jt]sx?$/,"")))fail(abs,"PROHIBITED_MODULE");
   const candidates=[
    stem,stem.replace(/\.js$/,".ts"),stem.replace(/\.js$/,".tsx"),
    stem.replace(/\.js$/,".mts"),stem.replace(/\.js$/,".cts"),
    stem.replace(/\.mjs$/,".mts"),stem.replace(/\.cjs$/,".cts"),
    stem+".ts",stem+".tsx",stem+".mts",stem+".cts",resolve(stem,"index.ts"),
   ];
   const target=candidates.find(p=>exists(p)&&ALLOWED_EXT.has(extname(p)));
   if(!target)fail(abs,"UNRESOLVED_SOURCE_IMPORT");
   const real=canonical(target);
   if(!inside(real))fail(abs,"OUTSIDE_CANONICAL_SOURCE");
   if(CI_MODULE.test(real))fail(abs,"PROHIBITED_CANONICAL_MODULE");
   visit(real);
  }
 }
 visit(resolve(sourceRoot,"app.ts"));
 visit(resolve(sourceRoot,"server.ts"));
 const vercel=resolve(sourceRoot,"index.ts");
 if(exists(vercel))visit(vercel);
 return Object.freeze({checked:visited.size,status:"P4_CI_ROUTE_ISOLATION_PASS"});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const r=inspectProductionGraph(readFileSync,existsSync,realpathSync);
  console.info(r.status+": "+r.checked+" production modules inspected");
 }catch(error){
  console.error("P4_CI_ROUTE_ISOLATION_FAIL",error?.reason??"READ_ERROR",error?.sourceFile??"unknown");process.exitCode=1;
 }
}
