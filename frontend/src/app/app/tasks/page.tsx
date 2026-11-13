import Link from "next/link";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { DemoTaskBoard } from "@/components/demo-task-board";
import { getDemoTasks } from "@/lib/demo-api";

export const dynamic = "force-dynamic";

export default async function DemoTasksPage() {
  const demo = await getDemoTasks();
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">WORKSPACE / FICTIONAL TASKS</span>
          <h1>Tasks</h1>
          <p>Internal task progress prototype. No user assignments or persistent work records.</p>
        </div>
        <Link href="/app" className="btn"><ArrowLeft size={15} aria-hidden="true"/> Overview</Link>
      </div>
      <div className="demo-banner" role="note">
        <CircleHelp size={18} aria-hidden="true"/>
        <div><strong>Fictional read-only API with browser-only task controls.</strong>
        <span>Source: {demo.source === "express-demo-api" ? "validated local Express demonstration" : "local fictional fallback"}.
        Changing a task is not a real workflow, message, follow-up, or API write.</span></div>
      </div>
      <DemoTaskBoard initialRecords={demo.records}/>
    </>
  );
}