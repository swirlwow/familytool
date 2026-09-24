export const supabase = { auth: {
  getUser: async () => ({ data: { user: { id: 'preview', email: 'preview@example.invalid' } } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  signOut: async () => ({ error: null }),
} };
