export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center shadow-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-red-400">403</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Access denied</h1>
        <p className="mt-3 text-sm text-gray-400">
          You do not have permission to view this group.
        </p>
      </div>
    </div>
  );
}
