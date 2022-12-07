import { type NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

const Register: NextPage = () => {
  return (
    <>
      <Head>
        <title>My Financials App</title>
        {/* <meta name='description' content='Generated by create-t3-app' />
        <link rel="icon" href="/favicon.ico" /> */}
      </Head>

      <main className='bg-gray-50'>
        <div className='pt:mt-0 mx-auto flex flex-col items-center justify-center px-6 pt-8 md:h-screen'>
          <Link href='/'>
            <a className='mb-8 flex items-center justify-center text-2xl font-semibold lg:mb-10'>
              <span className='self-center whitespace-nowrap text-2xl font-bold'>
                Financials App
              </span>
            </a>
          </Link>
          <div className='w-full rounded-lg bg-white shadow sm:max-w-screen-sm md:mt-0 xl:p-0'>
            <div className='space-y-8 p-6 sm:p-8 lg:p-16'>
              <h2 className='text-2xl font-bold text-gray-900 lg:text-3xl'>
                Create a Free Account
              </h2>
              <form className='mt-8 space-y-6' action='#'>
                <div>
                  <label
                    htmlFor='email'
                    className='mb-2 block text-sm font-medium text-gray-900'
                  >
                    Your email
                  </label>
                  <input
                    type='email'
                    name='email'
                    id='email'
                    className='block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-gray-900 focus:border-cyan-600 focus:ring-cyan-600 sm:text-sm'
                    placeholder='name@company.com'
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor='password'
                    className='mb-2 block text-sm font-medium text-gray-900'
                  >
                    Your password
                  </label>
                  <input
                    type='password'
                    name='password'
                    id='password'
                    placeholder='••••••••'
                    className='block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-gray-900 focus:border-cyan-600 focus:ring-cyan-600 sm:text-sm'
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor='confirm-password'
                    className='mb-2 block text-sm font-medium text-gray-900'
                  >
                    Confirm password
                  </label>
                  <input
                    type='password'
                    name='confirm-password'
                    id='confirm-password'
                    placeholder='••••••••'
                    className='block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-gray-900 focus:border-cyan-600 focus:ring-cyan-600 sm:text-sm'
                    required
                  />
                </div>
                <div className='flex items-start'>
                  <div className='flex h-5 items-center'>
                    <input
                      id='remember'
                      aria-describedby='remember'
                      name='remember'
                      type='checkbox'
                      className='focus:ring-3 h-4 w-4 rounded border-gray-300 bg-gray-50 focus:ring-cyan-200'
                      required
                    />
                  </div>
                  <div className='ml-3 text-sm'>
                    <label
                      htmlFor='remember'
                      className='font-medium text-gray-900'
                    >
                      I accept the{' '}
                      <a href='#' className='text-teal-500 hover:underline'>
                        Terms and Conditions
                      </a>
                    </label>
                  </div>
                </div>
                <button
                  type='submit'
                  className='w-full rounded-lg bg-cyan-600 px-5 py-3 text-center text-base font-medium text-white hover:bg-cyan-700 focus:ring-4 focus:ring-cyan-200 sm:w-auto'
                >
                  Create account
                </button>
                <div className='text-sm font-medium text-gray-500'>
                  Already have an account?{' '}
                  <Link href='/'>
                    <a className='text-teal-500 hover:underline'>Login here</a>
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default Register;
