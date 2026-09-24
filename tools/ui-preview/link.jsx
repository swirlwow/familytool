export default function Link({ href, children, ...props }) {
  return <a href={href} {...props} onClick={event => {
    if (!['/settings/categories','/settings/payment-methods','/settings/merchants','/settings/payers','/'].includes(href)) { event.preventDefault(); return; }
    props.onClick?.(event);
  }}>{children}</a>;
}
