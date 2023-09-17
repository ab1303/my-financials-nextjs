export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='pt:mt-0 mx-auto flex flex-col items-center justify-center px-6 pt-8 md:h-screen'>
      <a className='mb-8 flex items-center justify-center text-2xl font-semibold lg:mb-10'>
        {/* <img src="/images/logo.svg" className="h-10 mr-4" alt="Windster Logo"> */}
        <span className='self-center whitespace-nowrap text-2xl font-bold'>
          My Financials
        </span>
      </a>
      <div className='w-full rounded-lg bg-white shadow sm:max-w-screen-sm md:mt-0 xl:p-0'>
        <div className='space-y-8 p-6 sm:p-8 lg:p-16'>{children}</div>
      </div>
    </div>
  );
}
