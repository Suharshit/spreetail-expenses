import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/layout/SignOutButton";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 p-6 flex flex-col">
        <h1 className="text-xl font-bold text-white mb-8">Spreetail Expenses</h1>
        <nav className="flex-1 space-y-2 text-gray-300">
          <Link
            href="/dashboard"
            className="block rounded-md px-3 py-2 transition-colors hover:bg-gray-800"
          >
            Dashboard
          </Link>
          <Link
            href="/groups"
            className="block rounded-md px-3 py-2 transition-colors hover:bg-gray-800"
          >
            Groups
          </Link>
        </nav>
        <div className="pt-8 mt-auto border-t border-gray-800">
          <div className="text-sm font-medium text-gray-300 mb-4 px-3 truncate">
            {session.user?.name}
          </div>
          <div className="px-3">
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
