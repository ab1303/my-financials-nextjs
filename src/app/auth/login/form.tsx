'use client';

import type { FormEvent } from 'react';

import { useRef } from 'react';
import { toast } from 'sonner';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/Label';

export default function LoginForm() {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (emailInputRef.current == null || passwordInputRef.current == null)
      return;

    const enteredEmail = emailInputRef.current.value;
    const enteredPassword = passwordInputRef.current.value;

    const result = await signIn('credentials', {
      redirect: false,
      email: enteredEmail,
      password: enteredPassword,
    });

    if (result) {
      if (result.error) {
        toast.error(`Could not log you in. Please check your credentials`);
        return;
      }

      toast.success('Login successful!');
      router.push('/home');
    }
  }

  return (
    <form className='space-y-5' onSubmit={handleSubmit}>
      <div className='space-y-1.5'>
        <Label htmlFor='email'>Email address</Label>
        <Input
          type='email'
          name='email'
          id='email'
          placeholder='name@company.com'
          required
          ref={emailInputRef}
          autoComplete='email'
        />
      </div>

      <div className='space-y-1.5'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='password'>Password</Label>
          <a href='#' className='text-xs text-primary hover:underline'>
            Forgot password?
          </a>
        </div>
        <Input
          type='password'
          name='password'
          id='password'
          placeholder='••••••••'
          required
          ref={passwordInputRef}
          autoComplete='current-password'
        />
      </div>

      <Button type='submit' className='w-full'>
        Sign in
      </Button>

      <p className='text-center text-sm text-muted-foreground'>
        Don&apos;t have an account?{' '}
        <Link
          href='/auth/register'
          className='text-primary hover:underline font-medium'
        >
          Create account
        </Link>
      </p>
    </form>
  );
}
