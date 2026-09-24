const router = { push: path => location.assign(path), replace: path => location.replace(path), refresh: () => location.reload() };
export const useRouter = () => router;
export const usePathname = () => location.pathname === '/' ? '/settings/categories' : location.pathname;
