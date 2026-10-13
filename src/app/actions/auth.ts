'use server';

import { signIn, signOut } from '@/auth';

export async function loginWithGoogle(redirectTo: string = '/') {
  await signIn('google', { redirectTo });
}

export async function logoutUser(redirectTo: string = '/') {
  await signOut({ redirectTo });
}
