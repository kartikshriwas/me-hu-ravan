import { auth } from '@/auth';
import { verifyAdminPermission } from '@/lib/adminAuth';
import { notFound } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const sessionUser = session?.user;

  const authResult = await verifyAdminPermission(sessionUser?.email);
  if (!authResult.isAuthorized) {
    notFound();
  }

  return <>{children}</>;
}
