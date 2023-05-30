'use client';

import type { SignInResponse } from 'next-auth/react';
import type { FormEvent } from 'react';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import router from 'next/router';
import { useRef } from 'react';
import { toast } from 'react-toastify';

export default function LoginForm() {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (emailInputRef.current == null || passwordInputRef.current == null)
      return;

    const enteredEmail = emailInputRef.current.value;
    const enteredPassword = passwordInputRef.current.value;

    const result: SignInResponse | undefined = await signIn<'credentials'>(
      'credentials',
      {
        redirect: false,
        email: enteredEmail,
        password: enteredPassword,
      }
    );

    if (result) {
      if (!result.ok) {
        toast.error(`Could not log you in. Please check your credentials`);
        return;
      }

      toast.success('Login successful!');
      router.push('/home');
    }
  }
  return (
    <form className='mt-8 space-y-6' onSubmit={handleSubmit}>
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
          ref={emailInputRef}
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
          ref={passwordInputRef}
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
          />
        </div>
        <div className='ml-3 text-sm'>
          <label htmlFor='remember' className='font-medium text-gray-900'>
            Remember me
          </label>
        </div>
        <a href='#' className='ml-auto text-sm text-teal-500 hover:underline'>
          Lost Password?
        </a>
      </div>
      <button
        type='submit'
        className='w-full rounded-lg bg-cyan-600 px-5 py-3 text-center text-base font-medium text-white hover:bg-cyan-700 focus:ring-4 focus:ring-cyan-200 sm:w-auto'
      >
        Login to your account
      </button>
      <div className='text-sm font-medium text-gray-500'>
        Not registered?{' '}
        <Link href='/auth/register' className='text-teal-500 hover:underline'>
          Create account
        </Link>
      </div>
    </form>
  );
}
