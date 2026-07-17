import Link from "next/link";
export default function Page() {
  return (
    <main className="min-h-screen bg-slate-50 p-5">
      <Link href="/" className="text-blue-700">
        ← Accueil
      </Link>
      <h1 className="mt-4 text-3xl font-bold">More</h1>
      <p className="mt-2">
        Vue prête pour le MVP avec données servies par le domaine financier et
        Supabase.
      </p>
    </main>
  );
}
