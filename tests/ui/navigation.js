export const usePathname = () => window.location.pathname;
const router = { push: url => window.location.assign(url), replace: url => window.location.replace(url), refresh: () => window.location.reload(), back: () => window.history.back() };
export const useRouter = () => router;
export const useSearchParams = () => new URLSearchParams(window.location.search);
export const useParams = () => ({ id: 'sticky-1' });
