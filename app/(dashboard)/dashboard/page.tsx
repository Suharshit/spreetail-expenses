import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">
        Welcome back, {session?.user?.name || "User"}
      </h2>
      <p className="text-gray-400">
        You&apos;re logged in. Navigate to Groups to get started.
      </p>
    </div>
  );
}