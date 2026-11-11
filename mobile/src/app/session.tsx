import { Redirect } from 'expo-router';
import { Session } from '@/features/Session';
import { usePlan } from '@/lib/session';

export default function SessionScreen() {
  const plan = usePlan();
  if (!plan) return <Redirect href="/practice" />;
  // A new plan (new prompt, follow-up question) starts a fresh session.
  return <Session key={plan.id} plan={plan} />;
}
