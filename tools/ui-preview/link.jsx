export default function Link({ href, children, ...props }) {
  return <a href={href} {...props} onClick={event => {
    if (href === '/ledger/dashboard') { props.onClick?.(event); return; }
    if (!['/ledger','/shopping','/bills','/settlement','/settlement/history','/stickies','/investments','/calendar','/settings/backup','/settings/categories','/settings/payment-methods','/settings/merchants','/settings/payers','/'].includes(href)) { event.preventDefault(); return; }
    props.onClick?.(event);
  }}>{children}</a>;
}
