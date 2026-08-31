export const supabase = { auth: {
  getUser: async () => ({ data: { user: { id: 'fixture', email: 'ui-test@example.invalid' } } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  getSession: async () => ({ data: { session: null } }),
} };
