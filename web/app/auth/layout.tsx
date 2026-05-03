import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto w-full max-w-[420px] px-5 pb-6 pt-10">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Back to Vokler">
          <Image
            src="/logo-vokler.svg"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 object-contain"
            aria-hidden
            priority
          />
          <span className="font-sans text-[15px] font-bold tracking-tight">Vokler</span>
        </Link>
      </div>
      <main className="flex flex-1 flex-col justify-center">
        <div className="mx-auto w-full max-w-[420px] flex-1 px-5 pb-16 pt-4">{children}</div>
      </main>
    </div>
  );
}
