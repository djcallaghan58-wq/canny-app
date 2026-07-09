import { redirect } from 'next/navigation'

// Today (app/dashboard/today) is the new default landing page - see chat
// history. The old welcome dashboard moved to /dashboard/overview and is
// still reachable from the sidebar, just no longer what you land on.
export default function DashboardRoot() {
  redirect('/dashboard/today')
}
