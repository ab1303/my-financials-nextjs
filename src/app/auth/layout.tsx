import { APP_NAME } from '@/constants';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12'>
      <div className='w-full max-w-md space-y-8'>
        <div className='text-center'>
          <h1 className='text-3xl font-extrabold font-serif text-primary tracking-tight'>
            {APP_NAME}
          </h1>
          <p className='mt-2 text-sm text-muted-foreground'>
            Manage your finances with confidence
          </p>
        </div>
        <div className='rounded-xl border border-border bg-card shadow-md p-8'>
          {children}
        </div>
      </div>
    </div>
  );
}
