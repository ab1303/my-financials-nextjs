'use client';

import { trpc } from '@/server/trpc/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/Label';

export default function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const router = useRouter();

  const registerMutation = trpc.auth.register.useMutation({
    onError(err: any) {
      toast.error(err.message);
    },

    onSuccess() {
      toast.success('Registration successful!');
      router.push('/auth/login');
    },
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== passwordConfirm) {
      toast.error('password does not match confirm password');
      return;
    }

    registerMutation.mutate({ email, password, passwordConfirm });
  };

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete='email'
        />
      </div>

      <div className='space-y-1.5'>
        <Label htmlFor='password'>Password</Label>
        <Input
          type='password'
          name='password'
          id='password'
          placeholder='••••••••'
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete='new-password'
        />
      </div>

      <div className='space-y-1.5'>
        <Label htmlFor='confirm-password'>Confirm password</Label>
        <Input
          type='password'
          name='confirm-password'
          id='confirm-password'
          placeholder='••••••••'
          required
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          autoComplete='new-password'
        />
      </div>

      <Button
        type='submit'
        className='w-full'
        isLoading={registerMutation.isPending}
      >
        Create account
      </Button>

      <p className='text-center text-sm text-muted-foreground'>
        Already have an account?{' '}
        <Link
          href='/auth/login'
          className='text-primary hover:underline font-medium'
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
