import Nav from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <Nav />
      <main className="md:pl-60 pt-14 md:pt-0">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">{children}</div>
      </main>
    </div>
  );
}
