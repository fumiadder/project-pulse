import { api } from '@/services/api';

export async function seedDemoDataIfNeeded() {
  try {
    const res = await api.fullSyncGet();
    if (res.projects && res.projects.length > 0) {
      console.log('Seed data already exists, skipping.');
      return;
    }
  } catch {
    // API not available or error - proceed to seed
  }

  // Dynamic import to keep seed data out of main bundle
  const { default: users } = await import('./users');
  const { default: projects } = await import('./projects');
  const { default: progress } = await import('./progress');

  await api.fullSyncPost({
    projects,
    progress,
    users,
    reports: [],
    daily_tags: [],
    settings: {},
  });
  console.log('Seed data pushed to API');
}
