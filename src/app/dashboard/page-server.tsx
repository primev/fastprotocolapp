import { Suspense } from 'react';
import DashboardContent from './DashboardContent';
import { pool } from '@/lib/fast-db';

async function fetchUsers() {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT 10'
    );
    console.log('Users data (server):', { users: rows });
  } catch (error) {
    console.error('Error fetching users (server):', error);
  }
}

const DashboardPage = async () => {
  // Fetch users on server side when dashboard loads
  await fetchUsers();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
};

export default DashboardPage;
