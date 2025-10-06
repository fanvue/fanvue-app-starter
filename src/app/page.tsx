import Image from "next/image";
import { getCurrentUser } from "@/lib/fanvue";

export default async function Home({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const me = await getCurrentUser();
  const isAuthed = !!me;
  const params = await searchParams;
  const errorParam = typeof params?.error === "string" ? params.error : undefined;
  const errorDescriptionParam = typeof params?.error_description === "string" ? params.error_description : undefined;
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[24px] row-start-2 items-center sm:items-start max-w-[720px] w-full">
        <Image
          src="/logo192.png"
          alt="Fanvue"
          width={180}
          height={38}
          priority
        />
        <div className="w-full rounded-lg border border-black/[.08] dark:border-white/[.145] p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-lg">Fanvue App Starter</h2>
            {isAuthed ? (
              <form action="/api/oauth/logout" method="post">
                <button className="rounded-full border border-solid border-transparent transition-colors bg-[#49f264ff] hover:bg-[#49f26433] text-black px-4 h-10 flex items-center gap-2 cursor-pointer hover:text-white group">
                  <svg
                    aria-hidden
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-black group-hover:text-white transition-colors"
                  >
                    <path d="m16 17 5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Logout
                </button>
              </form>
            ) : (
              <a
                className="rounded-full border border-solid border-transparent transition-colors bg-[#49f264ff] hover:bg-[#49f26433] text-black hover:text-white px-4 h-10 flex items-center gap-2 cursor-pointer"
                href="/api/oauth/login"
                target="_top"
              >
                <Image aria-hidden src="/logo192.png" alt="" width={20} height={20} />
                Login with Fanvue
              </a>
            )}
          </div>
          {!isAuthed && (errorParam || errorDescriptionParam) ? (
            <div className="mt-3 text-sm text-red-600">
              {(errorDescriptionParam as string) || (errorParam as string)}
            </div>
          ) : null}
          <div className="mt-4">
            {isAuthed ? (
              <pre className="text-xs overflow-auto p-3 rounded bg-black/[.05] dark:bg-white/[.06]">{JSON.stringify(me, null, 2)}</pre>
            ) : (
              <p className="text-sm text-black/70 dark:text-white/70">
                Click "Login with Fanvue" to authenticate and we will display your current user from the Fanvue API.
              </p>
            )}
          </div>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://api.fanvue.com/docs"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="Docs icon"
            width={16}
            height={16}
          />
          Fanvue API Docs
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://fanvue.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Website icon"
            width={16}
            height={16}
          />
          Visit fanvue.com →
        </a>
      </footer>
    </div>
  );
}
