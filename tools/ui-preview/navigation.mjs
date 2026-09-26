const router = { push: path => location.assign(path), replace: path => location.replace(path), refresh: () => location.reload() };
export const useRouter = () => router;
export const useParams = () => ({ id: location.pathname.split('/').filter(Boolean).at(-1) });
export const usePathname = () => location.pathname;
