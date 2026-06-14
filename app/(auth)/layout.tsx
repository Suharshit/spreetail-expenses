export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Spreetail Expenses</h1>
        </div>
        <div className="bg-gray-900 rounded-xl shadow-2xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}