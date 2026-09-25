/** Decorative local vector portraits; never used to identify or filter records. */
export function PayerAvatar({ name }: { name: string }) {
  const woman = name === "大美女";
  const man = name === "大帥哥";
  if (!woman && !man) return <span className="payer-avatar payer-avatar-fallback" aria-hidden="true">{name.slice(0, 1)}</span>;
  return <svg className="payer-avatar" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <circle cx="32" cy="32" r="32" fill={woman ? "#ffe0e5" : "#deecff"} />
    {woman && <path d="M15 55V28C15 3 49 3 49 28V55Z" fill="#705043" />}
    <path d="M13 64V55Q14 43 32 43Q50 43 51 55V64" fill={woman ? "#d75e79" : "#4c79ba"} />
    <path d="M26 43V49Q32 55 38 49V43" fill="#efbd98" />
    <ellipse cx="32" cy="29" rx="15" ry="18" fill="#ffdbb6" />
    <path d={woman ? "M17 28Q12 7 32 9Q52 8 47 30Q39 25 35 17Q30 26 17 28" : "M17 28Q10 16 21 13Q24 5 33 10Q51 8 48 28L42 21L36 24L29 18L22 27Z"} fill={woman ? "#705043" : "#344052"} />
    <circle cx="26" cy="31" r="1.4" fill="#43352f" /><circle cx="38" cy="31" r="1.4" fill="#43352f" />
    <ellipse cx="22" cy="36" rx="3" ry="1.6" fill="#f5a8a0" /><ellipse cx="42" cy="36" rx="3" ry="1.6" fill="#f5a8a0" />
    <path d="M28 39Q32 43 36 39" fill="none" stroke="#a56255" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M24 50L32 55L40 50" fill="none" stroke="#fff" strokeWidth="3" />
  </svg>;
}
